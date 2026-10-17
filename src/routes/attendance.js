// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Attendance } from "../models/Attendance.js"
import { Student } from "../models/Student.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /attendance - Get attendance sheet for a class + date
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { classId, date } = req.query

    if (!classId || !date) {
      return res.status(400).json({ error: "classId and date are required" })
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).json({ error: "Invalid classId format" })
    }

    const students = await Student.find({ classId, status: "active" })
      .sort({ rollNo: 1 })
      .select("firstName lastName rollNo admissionNo")
      .lean()

    const saved = await Attendance.findOne({ classId, date }).lean()

    const records = students.map((s) => {
      const existing = saved?.records?.find(
        (r) => r.studentId.toString() === s._id.toString(),
      )
      return {
        studentId: s._id,
        name: `${s.firstName} ${s.lastName || ""}`.trim(),
        rollNo: s.rollNo,
        admissionNo: s.admissionNo,
        status: existing?.status || null,
      }
    })

    return res.json({ classId, date, saved: Boolean(saved), records })
  } catch (err) {
    return next(err)
  }
})

//! POST /attendance - Save (upsert) attendance for a class + date
router.post("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { classId, date, records } = req.body

    if (!classId || !date || !Array.isArray(records)) {
      return res
        .status(400)
        .json({ error: "classId, date and records are required" })
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).json({ error: "Invalid classId format" })
    }

    const clean = records.map((r) => ({
      studentId: r.studentId,
      status: r.status || "present",
    }))

    const markedBy = req.user?.fullName || req.user?.username || "Staff"

    const doc = await Attendance.findOneAndUpdate(
      { classId, date },
      { records: clean, markedBy },
      { new: true, upsert: true, runValidators: true },
    )

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! GET /attendance/copy - Copy attendance from a previous date
router.get("/copy", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { classId, fromDate } = req.query

    if (!classId || !fromDate) {
      return res
        .status(400)
        .json({ error: "classId and fromDate are required" })
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).json({ error: "Invalid classId format" })
    }

    const source = await Attendance.findOne({ classId, date: fromDate }).lean()

    if (!source) {
      return res
        .status(404)
        .json({ error: `No attendance saved on ${fromDate}` })
    }

    return res.json(source)
  } catch (err) {
    return next(err)
  }
})

//! GET /attendance/summary/week - Last 7 days summary for dashboard
router.get("/summary/week", async (req, res, next) => {
  try {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const all = await Attendance.find({ date: { $gte: days[0] } }).lean()

    const out = days.map((date) => {
      const entries = all.filter((a) => a.date === date)
      const counts = { present: 0, absent: 0, late: 0, halfday: 0, leave: 0 }

      for (const e of entries) {
        for (const r of e.records || []) {
          if (counts[r.status] !== undefined) {
            counts[r.status] += 1
          }
        }
      }

      return { date, ...counts }
    })

    return res.json(out)
  } catch (err) {
    return next(err)
  }
})

export default router
