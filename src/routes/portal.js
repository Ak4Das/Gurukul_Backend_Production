// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Student } from "../models/Student.js"
import { Parent } from "../models/Parent.js"
import { Class } from "../models/Class.js"
import { Attendance } from "../models/Attendance.js"
import { Mark } from "../models/Mark.js"
import { Exam } from "../models/Exam.js"
import { Subject } from "../models/Subject.js"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { Notice } from "../models/Notice.js"
import { Ptm } from "../models/Ptm.js"
// middleware imports
import { authRequired, allowRoles } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// ---------- Student Snapshot Helper ----------
async function studentSnapshot(studentId) {
  if (!isValidObjectId(studentId)) return null

  const student = await Student.findById(studentId).lean()
  if (!student) return null

  // Fetch related records concurrently
  const [cls, allAttendance, sheets, exams, subjects, receipts] =
    await Promise.all([
      student.classId ? Class.findById(student.classId).lean() : null,
      Attendance.find({ classId: student.classId }).lean(),
      Mark.find({ classId: student.classId, status: "published" }).lean(),
      Exam.find().lean(),
      Subject.find().lean(),
      FeeReceipt.find({ studentId }).sort({ date: -1 }).lean(),
    ])

  // Attendance summary calculation
  const summary = { present: 0, absent: 0, late: 0, halfday: 0, leave: 0 }
  const recent = []
  const studentIdStr = student._id.toString()

  for (const day of allAttendance) {
    const rec = (day.records || []).find(
      (r) => r.studentId?.toString() === studentIdStr,
    )
    if (rec) {
      summary[rec.status] = (summary[rec.status] || 0) + 1
      recent.push({ date: day.date, status: rec.status })
    }
  }
  recent.sort((a, b) => (a.date < b.date ? 1 : -1))

  // Build ID lookup maps for performance
  const examMap = new Map(exams.map((e) => [e._id.toString(), e]))
  const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]))

  // Published results assembly
  const results = []
  for (const m of sheets) {
    const entry = (m.entries || []).find(
      (e) => e.studentId?.toString() === studentIdStr,
    )
    if (!entry) continue

    const exam = examMap.get(m.examId?.toString())
    const subject = subjectMap.get(m.subjectId?.toString())

    results.push({
      examId: m.examId,
      examName: exam?.name || "?",
      subject: subject?.name || "?",
      maxMarks: subject?.maxMarks || 100,
      marks: entry.marks,
      grade: entry.grade,
    })
  }

  // Outstanding fee balance calculation
  const balance = 0

  return {
    student,
    className: cls
      ? `${cls.name} ${cls.section} (${cls.academicYear})`
      : "",
    attendance: { summary, recent: recent.slice(0, 30) },
    results,
    fees: { receipts, balance },
    activeExams: exams.filter((e) =>
      ["scheduled", "ongoing"].includes(e.status),
    ),
  }
}

//! GET /portal/student - Student Portal View
router.get("/student", allowRoles("student"), async (req, res, next) => {
  try {
    if (!req.user.refId || !isValidObjectId(req.user.refId)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing reference student ID" })
    }

    const snap = await studentSnapshot(req.user.refId)
    if (!snap) {
      return res.status(404).json({ error: "Student record not found" })
    }

    return res.json(snap)
  } catch (err) {
    return next(err)
  }
})

//! GET /portal/parent - Parent Portal View
router.get("/parent", allowRoles("parent"), async (req, res, next) => {
  try {
    if (!req.user.refId || !isValidObjectId(req.user.refId)) {
      return res
        .status(400)
        .json({ error: "Invalid or missing reference parent ID" })
    }

    const parent = await Parent.findById(req.user.refId).lean()
    if (!parent) {
      return res.status(404).json({ error: "Parent record not found" })
    }

    // Query children matching parentId directly using MongoDB query filter
    const children = await Student.find({
      parentIds: { $in: [parent._id] },
    }).lean()

    const [snaps, ptm] = await Promise.all([
      Promise.all(children.map((child) => studentSnapshot(child._id))),
      Ptm.find().sort({ date: -1 }).lean(),
    ])

    return res.json({ parent, children: snaps, ptm })
  } catch (err) {
    return next(err)
  }
})

//! GET /portal/notices - Notices visible to current role
router.get("/notices", async (req, res, next) => {
  try {
    const audienceMap = {
      student: "students",
      teacher: "teachers",
      parent: "parents",
    }

    const isStaffOrAdmin = ["admin", "clerk", "supervisor"].includes(
      req.user.role,
    )
    const targetAudience = audienceMap[req.user.role]

    // Construct precise MongoDB query filter
    const filter = { status: "published" }
    if (!isStaffOrAdmin) {
      filter.$or = [
        { audience: "all" },
        ...(targetAudience ? [{ audience: targetAudience }] : []),
      ]
    }

    const notices = await Notice.find(filter).sort({ date: -1 }).lean()
    return res.json(notices)
  } catch (err) {
    return next(err)
  }
})

export default router
