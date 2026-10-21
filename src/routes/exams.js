import { Router } from "express"
import mongoose from "mongoose"
import { Exam } from "../models/Exam.js"
import { Mark } from "../models/Mark.js"
import { Student } from "../models/Student.js"
import { Subject } from "../models/Subject.js"
import { Class } from "../models/Class.js"
import { Settings } from "../models/Settings.js"
import {
  authRequired,
  allowRoles,
  STAFF_TEACHER,
  STAFF,
} from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// ---------- Grade Helper ----------
function computeGrade(marks, maxMarks, passingMarks) {
  if (marks == null || marks === "") return { grade: "-", pass: false }
  const pct = (Number(marks) / Number(maxMarks || 100)) * 100
  const pass = Number(marks) >= Number(passingMarks || 33)
  let grade = "F"
  if (pct >= 90) grade = "A+"
  else if (pct >= 80) grade = "A"
  else if (pct >= 70) grade = "B+"
  else if (pct >= 60) grade = "B"
  else if (pct >= 50) grade = "C"
  else if (pass) grade = "D"
  return { grade, pass, pct: Math.round(pct * 10) / 10 }
}

// ==========================================
// GET /exams - List all exams
// ==========================================
router.get("/", async (req, res, next) => {
  try {
    const query = {}
    if (req.query.status) query.status = String(req.query.status)

    const exams = await Exam.find(query).sort({ startDate: -1 }).lean()
    return res.json(exams)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// POST /exams - Schedule new exam
// ==========================================
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = req.body
    if (!b.name || !b.startDate) {
      return res
        .status(400)
        .json({ error: "Exam name and start date are required" })
    }

    const doc = await Exam.create({
      status: "scheduled",
      classIds: b.classIds || [],
      ...b,
    })

    return res.status(201).json(doc)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// PUT /exams/:id - Update exam details
// ==========================================
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await Exam.findByIdAndUpdate(req.params.id, b, {
      new: true,
      runValidators: true,
    }).lean()

    if (!updated) {
      return res.status(404).json({ error: "Exam not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// DELETE /exams/:id - Remove exam and associated marks
// ==========================================
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    await Exam.findByIdAndDelete(req.params.id)
    await Mark.deleteMany({ examId: req.params.id })

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// GET /exams/:examId/marks - Fetch mark sheet pre-filled with class roster
// ==========================================
router.get(
  "/:examId/marks",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const { classId, subjectId } = req.query
      if (!classId || !subjectId) {
        return res
          .status(400)
          .json({ error: "classId and subjectId are required" })
      }
      if (
        !isValidObjectId(req.params.examId) ||
        !isValidObjectId(classId) ||
        !isValidObjectId(subjectId)
      ) {
        return res.status(400).json({ error: "Invalid parameters provided" })
      }

      const [students, subject, saved] = await Promise.all([
        Student.find({ classId, status: "active" }).sort({ rollNo: 1 }).lean(),
        Subject.findById(subjectId).lean(),
        Mark.findOne({ examId: req.params.examId, classId, subjectId }).lean(),
      ])

      const entryMap = new Map(
        (saved?.entries || []).map((e) => [e.studentId?.toString(), e]),
      )

      const entries = students.map((s) => {
        const e = entryMap.get(s._id.toString())
        return {
          studentId: s._id,
          name: `${s.firstName} ${s.lastName || ""}`.trim(),
          rollNo: s.rollNo,
          admissionNo: s.admissionNo,
          marks: e?.marks ?? "",
          grade: e?.grade || "-",
        }
      })

      return res.json({ status: saved?.status || "draft", subject, entries })
    } catch (err) {
      return next(err)
    }
  },
)

// ==========================================
// POST /exams/:examId/marks - Save/Submit marks
// ==========================================
router.post(
  "/:examId/marks",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const { classId, subjectId, entries, action } = req.body
      if (
        !isValidObjectId(req.params.examId) ||
        !isValidObjectId(classId) ||
        !isValidObjectId(subjectId)
      ) {
        return res.status(400).json({ error: "Invalid Parameters" })
      }

      const subject = await Subject.findById(subjectId).lean()
      if (!subject) return res.status(400).json({ error: "Invalid subject" })

      const existing = await Mark.findOne({
        examId: req.params.examId,
        classId,
        subjectId,
      })
      if (
        existing &&
        ["locked", "published"].includes(existing.status) &&
        req.user.role === "teacher"
      ) {
        return res
          .status(403)
          .json({
            error: "Marks are locked. Contact administrator to make changes.",
          })
      }

      const graded = (entries || []).map((e) => {
        const g = computeGrade(e.marks, subject.maxMarks, subject.passingMarks)
        return {
          studentId: e.studentId,
          marks: e.marks === "" ? null : Number(e.marks),
          grade: g.grade,
          pass: g.pass,
        }
      })

      const status = ["draft", "submitted", "locked"].includes(action)
        ? action
        : "draft"
      const payload = {
        examId: req.params.examId,
        classId,
        subjectId,
        entries: graded,
        status,
        enteredBy:
          req.user?.fullName || req.user?.name || req.user?.username || "Staff",
      }

      const doc = await Mark.findOneAndUpdate(
        { examId: req.params.examId, classId, subjectId },
        payload,
        { upsert: true, new: true, runValidators: true },
      ).lean()

      return res.json(doc)
    } catch (err) {
      return next(err)
    }
  },
)

// ==========================================
// POST /exams/:examId/publish - Publish results (Admin only)
// ==========================================
router.post("/:examId/publish", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.examId)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    const publishedName =
      req.user?.fullName || req.user?.name || req.user?.username || "Admin"
    const updateResult = await Mark.updateMany(
      { examId: req.params.examId, status: { $in: ["submitted", "locked"] } },
      {
        status: "published",
        publishedBy: publishedName,
        publishedAt: new Date().toISOString(),
      },
    )

    await Exam.findByIdAndUpdate(req.params.examId, { status: "published" })

    return res.json({ ok: true, publishedSheets: updateResult.modifiedCount })
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// GET /exams/:examId/results - Exam results overview & toppers list
// ==========================================
router.get("/:examId/results", async (req, res, next) => {
  try {
    const { classId } = req.query
    if (
      !isValidObjectId(req.params.examId) ||
      (classId && !isValidObjectId(classId))
    ) {
      return res.status(400).json({ error: "Invalid ID parameters" })
    }

    const query = { examId: req.params.examId }
    if (classId) query.classId = classId

    const [sheets, subjects, students] = await Promise.all([
      Mark.find(query).lean(),
      Subject.find({}).lean(),
      Student.find(classId ? { classId } : {}).lean(),
    ])

    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]))
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]))

    const perStudent = {}
    const gradeDist = {}

    for (const sheet of sheets) {
      const subj = subjectMap.get(sheet.subjectId?.toString())
      for (const e of sheet.entries || []) {
        if (e.marks == null) continue
        const studentIdStr = e.studentId?.toString()
        if (!perStudent[studentIdStr]) {
          perStudent[studentIdStr] = { total: 0, max: 0, subjects: [] }
        }
        perStudent[studentIdStr].total += e.marks
        perStudent[studentIdStr].max += subj?.maxMarks || 100
        perStudent[studentIdStr].subjects.push({
          subject: subj?.name,
          marks: e.marks,
          grade: e.grade,
          maxMarks: subj?.maxMarks,
        })
        gradeDist[e.grade] = (gradeDist[e.grade] || 0) + 1
      }
    }

    const ranked = Object.entries(perStudent)
      .map(([studentId, v]) => {
        const s = studentMap.get(studentId)
        return {
          studentId,
          name: s ? `${s.firstName} ${s.lastName || ""}`.trim() : "?",
          admissionNo: s?.admissionNo,
          rollNo: s?.rollNo,
          total: v.total,
          max: v.max,
          pct: v.max ? Math.round((v.total / v.max) * 1000) / 10 : 0,
          subjects: v.subjects,
        }
      })
      .sort((a, b) => b.pct - a.pct)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    return res.json({
      ranked,
      gradeDist,
      sheets: sheets.map(({ entries, ...s }) => ({
        ...s,
        entriesCount: entries?.length || 0,
      })),
    })
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// GET /exams/:examId/hall-tickets - Generate hall tickets
// ==========================================
router.get("/:examId/hall-tickets", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.examId)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    const exam = await Exam.findById(req.params.examId).lean()
    if (!exam) return res.status(404).json({ error: "Exam not found" })

    let students = []
    if (req.user.role === "student") {
      students = await Student.find({ _id: req.user.refId }).lean()
    } else if (req.user.role === "parent") {
      students = await Student.find({
        parentIds: { $in: [req.user.refId] },
        status: "active",
      }).lean()
    } else {
      const q = { status: "active" }
      if (req.query.classId && isValidObjectId(req.query.classId)) {
        q.classId = req.query.classId
      }
      students = await Student.find(q).sort({ rollNo: 1 }).lean()
    }

    const [classes, subjects, settings] = await Promise.all([
      Class.find({}).lean(),
      Subject.find({}).lean(),
      Settings.findOne({ key: "school" }).lean(),
    ])

    const classMap = new Map(
      classes.map((c) => [
        c._id.toString(),
        `${c.name} ${c.section} (${c.academicYear})`,
      ]),
    )

    const tickets = students.map((s) => {
      const className = classMap.get(s.classId?.toString()) || "?"
      const classSubjects = subjects.filter((x) =>
        (x.classIds || [])
          .map((id) => id.toString())
          .includes(s.classId?.toString()),
      )

      return {
        student: {
          name: `${s.firstName} ${s.lastName || ""}`.trim(),
          admissionNo: s.admissionNo,
          rollNo: s.rollNo,
        },
        className,
        exam: {
          name: exam.name,
          startDate: exam.startDate,
          endDate: exam.endDate,
        },
        subjects: classSubjects.map((x) => x.name),
        school: settings?.value?.schoolName || "School",
      }
    })

    return res.json(tickets)
  } catch (err) {
    return next(err)
  }
})

export default router
