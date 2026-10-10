// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Student } from "../models/Student.js"
import { Parent } from "../models/Parent.js"
import { User } from "../models/User.js"
import { nextSeq } from "../models/Counter.js"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { FeeStructure } from "../models/FeeStructure.js"
import { Attendance } from "../models/Attendance.js"
import { Mark } from "../models/Mark.js"
import { Exam } from "../models/Exam.js"
import { Subject } from "../models/Subject.js"

import {
  authRequired,
  allowRoles,
  STAFF,
  STAFF_TEACHER,
} from "../middleware/auth.js"
import { Class } from "../models/Class.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /students - List and filter students
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const query = req.query

    let docs = await Student.find(query).sort({ admissionNo: 1 })

    return res.json(docs)
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id - Get single student
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const doc = await Student.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({ error: "Student not found" })
    }

    const studentIdStr = doc._id.toString()
    const userRefIdStr = req.user.refId ? req.user.refId.toString() : ""

    // Students may only see themselves
    if (req.user.role === "student" && userRefIdStr !== studentIdStr) {
      return res.status(403).json({ error: "Forbidden" })
    }

    // Parents may only see their linked children
    if (req.user.role === "parent") {
      const parentIdsStr = (doc.parentIds || []).map((id) => id.toString())
      if (!parentIdsStr.includes(userRefIdStr)) {
        return res.status(403).json({ error: "Forbidden" })
      }
    }

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! POST /students - Create student & credentials
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { loginPassword, parentPassword, ...others } = req.body

    if (!others.firstName || !others.classId) {
      return res
        .status(400)
        .json({ error: "Student name and class are required" })
    }

    if (!isValidObjectId(others.classId)) {
      return res.status(400).json({ error: "Invalid class ID format" })
    }

    const year = new Date().getFullYear()
    const seq = await nextSeq("admissionNo")
    const admissionNo = `${year}-${String(seq).padStart(8, "0")}`

    const klass = await Class.findById(others.classId)
    if (!klass) {
      return res.status(400).json({ error: "Please select a valid class" })
    }
    const rollNo = await nextSeq(`${klass.name}${klass.section} - roll`)

    const studentData = {
      ...others,
      admissionNo,
      rollNo,
      parentIds: others.parentIds || [],
    }

    const student = await Student.create(studentData)
    const credentials = {}

    // Auto-create parent from inline parent details
    if (others.parentName && !student.parentIds.length) {
      let parent = others.parentMobile
        ? await Parent.findOne({ mobile: others.parentMobile })
        : null

      if (!parent) {
        parent = await Parent.create({
          name: others.parentName,
          relation: others.parentRelation || "Guardian",
          mobile: others.parentMobile || "",
          email: others.parentEmail || "",
          occupation: others.parentOccupation || "",
          address: others.address || "",
          status: "active",
        })

        const pSeq = await nextSeq("parentUser")
        const pUsername = `parent${pSeq}`
        const pPassword = parentPassword || "parent123"

        await User.create({
          username: pUsername,
          fullName: parent.name,
          role: "parent",
          status: "active",
          refId: parent._id,
          mobile: parent.mobile,
          email: parent.email,
          passwordHash: pPassword, // Handled by User pre-save hook
          address: others.address || "",
          gender:
            others.parentRelation === "Father"
              ? "Male"
              : others.parentRelation === "Mother"
                ? "Female"
                : "",
        })

        credentials.parentUsername = pUsername
        credentials.parentPassword = pPassword
      }

      student.parentIds = [parent._id]
      await student.save()
    }

    // Student login account
    const sSeq = await nextSeq("studentUser")
    const sUsername = `student${sSeq}`
    const sPassword = loginPassword || "student123"

    await User.create({
      username: sUsername,
      fullName: `${others.firstName} ${others.lastName || ""}`.trim(),
      role: "student",
      status: "active",
      refId: student._id,
      passwordHash: sPassword, // Handled by User pre-save hook
      gender: others.gender,
      address: others.address,
      dob: others.dob,
      joined: others.admissionDate,
    })

    credentials.studentUsername = sUsername
    credentials.studentPassword = sPassword

    return res.status(201).json({ ...student.toObject(), credentials })
  } catch (err) {
    return next(err)
  }
})

//! PUT /students/:id - Update student
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const studentObj = await Student.findById(req.params.id)

    if (!studentObj) {
      return res.status(400).json({ error: "Student not found" })
    }

    const b = { ...req.body }
    delete b._id
    delete b.loginPassword
    delete b.parentPassword
    delete b.credentials

    const studentData = {
      ...b,
    }

    if (studentObj.classId.toString() !== b.classId) {
      const klass = await Class.findById(b.classId)
      if (!klass) {
        return res.status(400).json({ error: "Please select a valid class" })
      }
      const rollNo = await nextSeq(`${klass.name}${klass.section} - roll`)

      studentData.rollNo = rollNo
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      studentData,
      {
        new: true,
        runValidators: true,
      },
    )

    if (!updatedStudent) {
      return res.status(404).json({ error: "Student not found" })
    }

    await User.findOneAndUpdate(
      { refId: req.params.id },
      {
        fullName: `${b.firstName} ${b.lastName || ""}`.trim(),
        status: b.status,
        gender: b.gender,
        address: b.address,
        dob: b.dob,
        joined: b.admissionDate,
      },
      {
        new: true,
        runValidators: true,
      },
    )

    return res.json(updatedStudent)
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/fees - Fee summary
router.get("/:id/fees", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const receipts = await FeeReceipt.find({ studentId: req.params.id }).sort({
      date: -1,
    })
    const structures = await FeeStructure.find()
    const student = await Student.findById(req.params.id)

    return res.json({ receipts, structures, student })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/attendance - Attendance summary
router.get("/:id/attendance", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const { from, to } = req.query
    const all = await Attendance.find()
    const records = []

    // continue is used inside a loop (for, while, do...while) to skip the remaining code of the current iteration and move directly to the next iteration.
    for (const day of all) {
      if (from && day.date < from) continue
      if (to && day.date > to) continue

      const rec = (day.records || []).find(
        (r) => r.studentId?.toString() === req.params.id,
      )
      if (rec) {
        records.push({
          date: day.date,
          status: rec.status,
          classId: day.classId,
        })
      }
    }

    records.sort((a, b) => (a.date < b.date ? 1 : -1))

    const summary = {}
    for (const r of records) {
      summary[r.status] = (summary[r.status] || 0) + 1
    }

    return res.json({ records, summary })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/results - Academic marks
router.get("/:id/results", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.id)
    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    const allMarks = await Mark.find({ classId: student.classId })
    const exams = await Exam.find()
    const subjects = await Subject.find()

    const visible = req.user.role === "student" || req.user.role === "parent"
    const results = []

    for (const m of allMarks) {
      if (visible && m.status !== "published") continue

      const entry = (m.entries || []).find(
        (e) => e.studentId?.toString() === req.params.id,
      )
      if (!entry) continue

      const exam = exams.find((e) => e._id.toString() === m.examId?.toString())
      const subject = subjects.find(
        (s) => s._id.toString() === m.subjectId?.toString(),
      )

      results.push({
        examId: m.examId,
        examName: exam?.name || "?",
        subject: subject?.name || "?",
        maxMarks: subject?.maxMarks || 100,
        marks: entry.marks,
        grade: entry.grade,
        status: m.status,
      })
    }

    return res.json({ student, results })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/parents - Linked parents
router.get("/:id/parents", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.id)
    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    const parents = await Parent.find({ _id: { $in: student.parentIds || [] } })
    return res.json(parents)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /students/:id - Delete student
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    await Student.findByIdAndDelete(req.params.id)
    await User.findOneAndDelete({ role: "student", refId: req.params.id })

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
