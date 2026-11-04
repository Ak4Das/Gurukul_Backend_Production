// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Exam } from "../models/Exam.js"
import { Mark } from "../models/Mark.js"
import { Student } from "../models/Student.js"
import { Subject } from "../models/Subject.js"
// middleware imports
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

function computeGrade(marks, maxMarks, passingMarks) {
  if (marks == null || marks === "") {
    return { grade: "-", pass: false }
  }
  const pct = (Number(marks) / Number(maxMarks || 100)) * 100
  const pass = Number(marks) >= Number(passingMarks || 33)
  let grade = "F"
  if (pct >= 90) {
    grade = "A+"
  } else if (pct >= 80) {
    grade = "A"
  } else if (pct >= 70) {
    grade = "B+"
  } else if (pct >= 60) {
    grade = "B"
  } else if (pct >= 50) {
    grade = "C"
  } else if (pass) {
    grade = "D"
  }
  return { grade, pass, pct: pct.toFixed(1) }
}

//! GET /exams - List all exams
router.get("/", async (req, res, next) => {
  try {
    const query = { academicYear: "2026-2027" }
    if (req.query.status) {
      query.status = String(req.query.status)
    }

    const exams = await Exam.find(query).sort({ startDate: -1 }).lean()
    return res.json(exams)
  } catch (err) {
    return next(err)
  }
})

//! POST /exams - Schedule new exam
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { name, type, startDate, endDate, classIds, academicYear } = req.body

    if (!name || !type || !startDate || !endDate || !academicYear) {
      return res.status(400).json({
        error:
          "Name, type, start date, end date and academic year are required",
      })
    }

    const isExist = await Exam.find({ name: name.trim() })

    if (isExist.length !== 0) {
      return res.status(400).json({
        error: "A exam with this name is already exists",
      })
    }

    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    if (!classIds.every((id) => isValidObjectId(id))) {
      return res.status(400).json({
        error: "One or more class IDs are invalid",
      })
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error: "End date must be greater than or equal to start date",
      })
    }

    const exam = await Exam.create({
      name: name.trim(),
      type,
      startDate,
      endDate,
      classIds,
      academicYear,
      status: "scheduled",
    })

    return res.status(201).json(exam)
  } catch (err) {
    return next(err)
  }
})

//! PUT /exams/:id - Update exam details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { id } = req.params

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid exam ID",
      })
    }

    const { name, type, startDate, endDate, classIds, academicYear } = req.body

    // Build update object using only allowed fields
    const update = {}

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          error: "Exam name cannot be empty",
        })
      }

      const isExist = await Exam.find({ name: name.trim(), _id: { $ne: id } })

      if (isExist.length !== 0) {
        return res.status(400).json({
          error: "A exam with this name is already exists",
        })
      }

      update.name = String(name).trim()
    }

    if (type !== undefined) {
      update.type = type
    }

    if (startDate !== undefined) {
      update.startDate = startDate
    }

    if (endDate !== undefined) {
      update.endDate = endDate
    }

    if (classIds !== undefined) {
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({
          error: "At least one class is required",
        })
      }

      if (!classIds.every((classId) => isValidObjectId(classId))) {
        return res.status(400).json({
          error: "One or more class IDs are invalid",
        })
      }

      update.classIds = classIds
    }

    if (academicYear !== undefined) {
      update.academicYear = academicYear
    }

    // Validate date relationship when either date is being changed
    if (startDate !== undefined || endDate !== undefined) {
      const existingExam = await Exam.findById(id).lean()

      if (!existingExam) {
        return res.status(404).json({
          error: "Exam not found",
        })
      }

      const finalStartDate = startDate ?? existingExam.startDate
      const finalEndDate = endDate ?? existingExam.endDate

      if (finalStartDate > finalEndDate) {
        return res.status(400).json({
          error: "End date must be greater than or equal to start date",
        })
      }
    }

    const updated = await Exam.findByIdAndUpdate(id, update, {
      returnDocument: "after",
      runValidators: true,
    }).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Exam not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /exams/:id - Remove exam and associated marks
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  let session
  try {
    session = await mongoose.startSession()

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    session.startTransaction()
    await Exam.findByIdAndDelete(req.params.id, { session })
    await Mark.deleteMany({ examId: req.params.id }, { session })
    await session.commitTransaction()

    return res.json({ ok: true })
  } catch (err) {
    await session.abortTransaction()
    return next(err)
  } finally {
    await session.endSession()
  }
})

//! GET /exams/:examId/marks - Fetch mark sheet
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

      // In this Map object we store studentIds as key and mark details as value
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

//! POST /exams/:examId/marks - Save/Submit marks
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
        return res.status(400).json({
          error: "Invalid Parameters",
        })
      }

      const subject = await Subject.findById(subjectId).lean()

      if (!subject) {
        return res.status(400).json({
          error: "Invalid subject",
        })
      }

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
        return res.status(403).json({
          error:
            "Marks are locked or published. Contact administrator to make changes.",
        })
      }

      // Validate that all active students have marks before submission
      if (action === "submitted") {
        const students = await Student.find({
          classId,
          status: "active",
        })
          .select("_id firstName lastName rollNo admissionNo")
          .sort({ rollNo: 1 })
          .lean()

        const entriesMap = new Map(
          (entries || []).map((entry) => [entry.studentId?.toString(), entry]),
        )

        const missingMarks = students.filter((student) => {
          const entry = entriesMap.get(student._id.toString())

          return (
            !entry ||
            entry.marks === undefined ||
            entry.marks === null ||
            entry.marks === ""
          )
        })

        if (missingMarks.length > 0) {
          return res.status(400).json({
            error: "All students must have marks before submitting.",
          })
        }
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
          req.user?.username || req.user?.fullName || req.user?.name || "Staff",
      }

      const doc = await Mark.findOneAndUpdate(
        {
          examId: req.params.examId,
          classId,
          subjectId,
        },
        payload,
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
        },
      ).lean()

      return res.json(doc)
    } catch (err) {
      return next(err)
    }
  },
)

//! POST /exams/:examId/publish - Publish results (Admin only)
router.post("/:examId/publish", allowRoles("admin"), async (req, res, next) => {
  let session
  try {
    session = await mongoose.startSession()

    if (!isValidObjectId(req.params.examId)) {
      return res.status(400).json({ error: "Invalid exam ID" })
    }

    session.startTransaction()

    const exam = await Exam.findById(req.params.examId).session(session).lean()

    if (!exam) {
      await session.abortTransaction()

      return res.status(404).json({
        error: "Exam not found",
      })
    }

    // Get all subjects assigned to any class of this exam
    const subjects = await Subject.find({
      classIds: { $in: exam.classIds },
    })
      .session(session)
      .lean()

    // Build all expected class + subject combinations
    const expectedSheets = []

    for (const classId of exam.classIds) {
      for (const subject of subjects) {
        const subjectBelongsToClass = subject.classIds.some(
          (id) => id.toString() === classId.toString(),
        )

        if (subjectBelongsToClass) {
          expectedSheets.push({
            classId: classId.toString(),
            subjectId: subject._id.toString(),
            subjectName: subject.name,
          })
        }
      }
    }

    // Get all mark sheets created for this exam
    const marks = await Mark.find({
      examId: req.params.examId,
      status: "submitted",
    })
      .session(session)
      .lean()

    // Create a quick lookup of submitted mark sheets
    const submittedSheets = new Set(
      marks.map(
        (mark) => `${mark.classId.toString()}_${mark.subjectId.toString()}`,
      ),
    )

    // Find expected papers that are not submitted
    const pendingSheets = expectedSheets.filter(
      (sheet) => !submittedSheets.has(`${sheet.classId}_${sheet.subjectId}`),
    )

    // Do not publish until every expected paper is submitted
    if (pendingSheets.length > 0) {
      await session.abortTransaction()

      return res.status(400).json({
        error:
          "All subject papers must be submitted by teachers before publishing.",
      })
    }

    // Publish all submitted mark sheets
    const publishedName = req.user?.username || "Admin"

    const updateResult = await Mark.updateMany(
      {
        examId: req.params.examId,
        status: "submitted",
      },
      {
        status: "published",
        publishedBy: publishedName,
        publishedAt: new Date().toISOString().slice(0, 10),
      },
      { session },
    )

    // Update exam status
    await Exam.findByIdAndUpdate(
      req.params.examId,
      {
        status: "published",
      },
      {
        session,
        runValidators: true,
      },
    )

    await session.commitTransaction()

    return res.json({
      ok: true,
      publishedSheets: updateResult.modifiedCount,
    })
  } catch (err) {
    await session.abortTransaction()
    return next(err)
  } finally {
    await session.endSession()
  }
})

//! GET /exams/:examId/results Exam results overview & toppers list
router.get("/:examId/results", async (req, res, next) => {
  try {
    const { classId } = req.query

    if (
      !isValidObjectId(req.params.examId) ||
      (classId && !isValidObjectId(classId))
    ) {
      return res.status(400).json({
        error: "Invalid ID parameters",
      })
    }

    const exam = await Exam.findById(req.params.examId).lean()

    if (!exam) {
      return res.status(404).json({
        error: "Exam not found",
      })
    }

    // Results are available only after the exam is published
    if (exam.status !== "published") {
      return res.status(400).json({
        error: "Results are available only after the exam is published.",
      })
    }

    const query = {
      examId: req.params.examId,
    }

    if (classId) {
      query.classId = classId
    }

    const [sheets, subjects] = await Promise.all([
      Mark.find(query).lean(),
      Subject.find({ classIds: classId }).lean(),
    ])

    const studentIds = [
      ...new Set(
        sheets.flatMap((sheet) =>
          (sheet.entries || []).map((entry) => entry.studentId?.toString()),
        ),
      ),
    ]

    const students = await Student.find({
      _id: { $in: studentIds },
    }).lean()

    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]))

    const studentMap = new Map(students.map((s) => [s._id.toString(), s]))

    const perStudent = {}

    for (const sheet of sheets) {
      const subj = subjectMap.get(sheet.subjectId?.toString())

      for (const e of sheet.entries || []) {
        const studentIdStr = e.studentId?.toString()

        if (!perStudent[studentIdStr]) {
          perStudent[studentIdStr] = {
            total: 0,
            max: 0,
            subjects: [],
          }
        }

        perStudent[studentIdStr].total += e.marks
        perStudent[studentIdStr].max += subj?.maxMarks || 100

        perStudent[studentIdStr].subjects.push({
          subject: subj?.name,
          marks: e.marks,
          grade: e.grade,
          maxMarks: subj?.maxMarks,
        })
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
      .map((r, i) => ({
        ...r,
        rank: i + 1,
      }))

    return res.json({
      ranked,
      sheets: sheets.map(({ entries, ...s }) => ({
        ...s,
        entriesCount: entries?.length || 0,
      })),
    })
  } catch (err) {
    return next(err)
  }
})

export default router
