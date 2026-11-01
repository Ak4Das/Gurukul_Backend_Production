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
import { Exam } from "../models/Exam.js"
import { Helpdesk } from "../models/Helpdesk.js"
import { Mark } from "../models/Mark.js"
import { Timetable } from "../models/Timetable.js"
// middleware imports
import { authRequired } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

//! GET /dashboard/stats - Admin Dashboard Analytics
router.get("/stats", async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10)

    // Build rolling 7-day date (yyyy-mm-dd) strings array
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
      activeExams,
      helpdesk,
      genderMixStats,
      feeTrendStats,
    ] = await Promise.all([
      // Total & Active Students Count
      // aggregate() is MongoDB's aggregation framework. and Student.aggregate tells mongoose that Run a MongoDB aggregation pipeline on the Student collection.
      // $group is used when you want to combine documents into groups and calculate something for each group.
      // _id: null means i want one overall group containing all students.
      // totalStudents: { $sum: 1 } means For every document in the group, MongoDB adds 1
      // $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } this means For every student, check whether their status is "active". If yes, add 1; otherwise add 0.
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
      // counts only users where role is teacher and status is active
      User.countDocuments({ role: "teacher", status: "active" }),
      // counts only classes where status is not equal to archived
      Class.countDocuments({ status: { $ne: "archived" } }),
      // count all subjects
      Subject.countDocuments(),
      // counts only classes where status is active
      Parent.countDocuments({ status: "active" }),

      // Today's Fee Receipts aggregated sum and count
      // FeeReceipt documents -> $match -> $group -> Final result
      // $match is used to filter documents it is similar to the filter.
      // $group combine the remaining documents after $match and calculate todaysCollection from them.
      // todaysCollection is the sum of all feeReceipts amountPaid value
      FeeReceipt.aggregate([
        { $match: { date: today, status: { $ne: "refunded" } } },
        {
          $group: {
            _id: null,
            todaysCollection: { $sum: "$amountPaid" },
          },
        },
      ]),

      // Active Exams Count
      // counts only exams where status must be one of scheduled or ongoing
      Exam.countDocuments({ status: { $in: ["scheduled", "ongoing"] } }),

      // Open Incident / Support counts
      // counts only helpdesk tickets where status is open
      Helpdesk.countDocuments({ status: "open" }),

      // Gender distribution aggregation
      // The value of _id determines which group a document belongs to.
      // $ifNull means If $gender is null or missing, use "other" instead.
      // $toLower converts the resulting string to lowercase.
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
    ])

    // count number of male and female students
    const genderMix = {}

    genderMixStats.forEach((g) => {
      genderMix[g._id] = g.count
    })

    // previous 7 days total fee collection
    const feeTrendMap = new Map(feeTrendStats.map((f) => [f._id, f.amount]))

    const feeTrend = feeDates.map((date) => ({
      date,
      amount: feeTrendMap.get(date) || 0,
    }))

    return res.json({
      activeStudents: studentCounts[0]?.activeStudents || 0,
      totalStudents: studentCounts[0]?.totalStudents || 0,
      teachers,
      classes,
      subjects,
      parents,
      todaysCollection: todayFeeStats[0]?.todaysCollection || 0,
      outstanding: 0,
      activeExams,
      openTickets: helpdesk,
      genderMix,
      feeTrend,
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
      classesList,
      subjectsList,
      timetablesList,
      activeExamsCount,
      marksList,
    ] = await Promise.all([
      Class.find({}).lean(),
      Subject.find({}).lean(),
      Timetable.find({}).lean(),
      Exam.countDocuments({
        status: { $in: ["scheduled", "ongoing"] },
      }),
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

    // Extract teacher's timetable periods
    const teacherPeriods = []

    for (const tt of timetablesList) {
      for (const p of tt.periods || []) {
        if (p.teacherId?.toString() === teacherId.toString()) {
          teacherPeriods.push({
            ...(p.toObject ? p.toObject() : p),
            classId: tt.classId,
            className: classLabel(tt.classId),
            subjectName:
              p.subjectName || subjectMap.get(p.subjectId?.toString()) || "?",
          })
        }
      }
    }

    // Extract unique classes taught by teacher
    const myClassObjectIds = [
      ...new Set(
        teacherPeriods.map((p) => p.classId?.toString()).filter(Boolean),
      ),
    ]
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id))

    // Extract unique subjects taught by teacher
    const mySubjectIds = [
      ...new Set(
        teacherPeriods.map((p) => p.subjectId?.toString()).filter(Boolean),
      ),
    ]

    // Aggregate student counts per teacher's class
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

    // Today's Periods
    const dayName = new Date().toLocaleDateString("en-US", {
      weekday: "long",
    })

    const todaysPeriods = teacherPeriods
      .filter((p) => p.day === dayName)
      .sort((a, b) => a.period - b.period)

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

      todaysPeriods,

      stats: {
        classes: myClassIdStrings.length,
        subjects: mySubjectIds.length,
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
