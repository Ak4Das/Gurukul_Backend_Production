// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Student } from "../models/Student.js"
import { User } from "../models/User.js"
import { Class } from "../models/Class.js"
import { Subject } from "../models/Subject.js"
import { Parent } from "../models/Parent.js"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { Attendance } from "../models/Attendance.js"
import { Exam } from "../models/Exam.js"
import { Helpdesk } from "../models/Helpdesk.js"
import { Admission } from "../models/Admission.js"
import { Mark } from "../models/Mark.js"
import { Assignment } from "../models/Assignment.js"
import { Timetable } from "../models/Timetable.js"
// middleware imports
import { authRequired } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

// ==========================================
// GET /dashboard/stats - Admin Dashboard Analytics
// ==========================================
router.get("/stats", async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // Build rolling 7-day date strings array
    const feeDates = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      feeDates.push(d.toISOString().slice(0, 10))
    }

    const [
      studentCounts,
      teachers,
      classes,
      subjects,
      parents,
      todayFeeStats,
      attendanceStats,
      activeExams,
      helpdesk,
      genderMixStats,
      feeTrendStats,
      pendingAdmissions,
      sheetsAwaitingPublish,
      activeStudentsList,
    ] = await Promise.all([
      // Total & Active Students Count
      Student.aggregate([
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            activeStudents: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
          },
        },
      ]),

      // Count operations
      User.countDocuments({ role: "teacher", status: "active" }),
      Class.countDocuments({ status: { $ne: "archived" } }),
      Subject.countDocuments(),
      Parent.countDocuments({ status: "active" }),

      // Today's Fee Receipts aggregated sum and count
      FeeReceipt.aggregate([
        { $match: { date: today, status: { $ne: "refunded" } } },
        {
          $group: {
            _id: null,
            todaysCollection: { $sum: "$amountPaid" },
            receiptsToday: { $sum: 1 },
          },
        },
      ]),

      // Attendance records breakdown for today
      Attendance.aggregate([
        { $match: { date: today } },
        { $unwind: "$records" },
        {
          $group: {
            _id: null,
            marked: { $sum: 1 },
            present: {
              $sum: {
                $cond: [
                  { $in: ["$records.status", ["present", "late", "halfday"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Active Exams Count
      Exam.countDocuments({ status: { $in: ["scheduled", "ongoing"] } }),

      // Open Incident / Support counts
      Helpdesk.countDocuments({ status: "open" }),

      // Gender distribution aggregation
      Student.aggregate([
        { $match: { status: "active" } },
        {
          $group: {
            _id: { $toLower: { $ifNull: ["$gender", "other"] } },
            count: { $sum: 1 },
          },
        },
      ]),

      // 7-Day Fee Collection Aggregation
      FeeReceipt.aggregate([
        {
          $match: {
            date: { $in: feeDates },
            status: { $ne: "refunded" },
          },
        },
        {
          $group: {
            _id: "$date",
            amount: { $sum: "$amountPaid" },
          },
        },
      ]),

      // Admissions and Mark Sheets
      Admission.countDocuments({ status: "registered" }),
      Mark.countDocuments({ status: "submitted" }),

      // Active students dob payload for birthday matching
      Student.find({ status: "active", dob: { $ne: null } })
        .select("firstName lastName dob")
        .lean(),
    ])

    // Format Gender Mix
    const genderMix = {}
    genderMixStats.forEach((g) => {
      genderMix[g._id] = g.count
    })

    // Format 7-day Fee Trend with 0 fallback
    const feeTrendMap = new Map(feeTrendStats.map((f) => [f._id, f.amount]))
    const feeTrend = feeDates.map((date) => ({
      date,
      amount: feeTrendMap.get(date) || 0,
    }))

    // Birthday calculations (within upcoming 7 days)
    const birthdays = []
    const now = new Date()
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    for (const s of activeStudentsList) {
      if (!s.dob) continue
      const dob = new Date(s.dob)
      if (Number.isNaN(dob.getTime())) continue

      let next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      if (next < todayZero) {
        next.setFullYear(now.getFullYear() + 1)
      }

      const inDays = Math.round((next - todayZero) / 86400000)
      if (inDays <= 7) {
        const local = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`
        birthdays.push({
          name: `${s.firstName} ${s.lastName || ""}`.trim(),
          date: local,
          inDays,
          turns: next.getFullYear() - dob.getFullYear(),
        })
      }
    }
    birthdays.sort((a, b) => a.inDays - b.inDays)

    return res.json({
      activeStudents: studentCounts[0]?.activeStudents || 0,
      totalStudents: studentCounts[0]?.totalStudents || 0,
      teachers,
      classes,
      subjects,
      parents,
      todaysCollection: todayFeeStats[0]?.todaysCollection || 0,
      outstanding: 0,
      attendanceToday: {
        present: attendanceStats[0]?.present || 0,
        marked: attendanceStats[0]?.marked || 0,
      },
      activeExams,
      openTickets: helpdesk,
      genderMix,
      feeTrend,
      birthdays,
      pendingAdmissions,
      sheetsAwaitingPublish,
      receiptsToday: todayFeeStats[0]?.receiptsToday || 0,
    })
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// GET /dashboard/teacher - Teacher Specific Dashboard
// ==========================================
router.get("/teacher", async (req, res, next) => {
  try {
    const teacherId = req.user.id || req.user._id

    const [
      rawAssignments,
      classesList,
      subjectsList,
      timetablesList,
      activeExamsCount,
      marksList,
    ] = await Promise.all([
      Assignment.find({ teacherId }).lean(),
      Class.find({}).lean(),
      Subject.find({}).lean(),
      Timetable.find({}).lean(),
      Exam.countDocuments({ status: { $in: ["scheduled", "ongoing"] } }),
      Mark.find({ status: "draft" }).select("classId").lean(),
    ])

    // Map helper for quick lookup
    const classMap = new Map(
      classesList.map((c) => [
        c._id.toString(),
        `${c.name} ${c.section} (${c.academicYear})`,
      ]),
    )
    const subjectMap = new Map(
      subjectsList.map((s) => [s._id.toString(), s.name]),
    )

    const classLabel = (id) => (id ? classMap.get(id.toString()) || "?" : "?")

    // Extract unique assigned class IDs
    const myClassObjectIds = [
      ...new Set(rawAssignments.map((a) => a.classId?.toString())),
    ]
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id))

    // Aggregate student counts per assigned class
    const studentCountPerClass = await Student.aggregate([
      {
        $match: {
          status: "active",
          classId: { $in: myClassObjectIds },
        },
      },
      {
        $group: {
          _id: "$classId",
          count: { $sum: 1 },
        },
      },
    ])

    const studentCountMap = new Map(
      studentCountPerClass.map((sc) => [sc._id.toString(), sc.count]),
    )

    // Format Assignments array
    const assignments = rawAssignments.map((a) => ({
      ...a,
      className: classLabel(a.classId),
      subjectName: subjectMap.get(a.subjectId?.toString()) || "?",
      studentCount: studentCountMap.get(a.classId?.toString()) || 0,
    }))

    // Today's Periods Extraction
    const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" })
    const todaysPeriods = []

    for (const tt of timetablesList) {
      for (const p of tt.periods || []) {
        if (
          p.teacherId?.toString() === teacherId.toString() &&
          p.day === dayName
        ) {
          todaysPeriods.push({
            ...p,
            className: classLabel(tt.classId),
            classId: tt.classId,
          })
        }
      }
    }
    todaysPeriods.sort((a, b) => a.period - b.period)

    // Compute stats metrics
    const myClassIdStrings = myClassObjectIds.map((id) => id.toString())
    const draftSheets = marksList.filter((m) =>
      myClassIdStrings.includes(m.classId?.toString()),
    ).length

    const totalStudentsInMyClasses = Array.from(
      studentCountMap.values(),
    ).reduce((acc, val) => acc + val, 0)

    return res.json({
      dayName,
      assignments,
      todaysPeriods,
      stats: {
        classes: myClassIdStrings.length,
        subjects: [
          ...new Set(
            rawAssignments.map((a) => a.subjectId?.toString()).filter(Boolean),
          ),
        ].length,
        students: totalStudentsInMyClasses,
        draftSheets,
        activeExams: activeExamsCount,
      },
    })
  } catch (err) {
    return next(err)
  }
})

export default router
