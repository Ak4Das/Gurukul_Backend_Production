// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { User } from "../models/User.js"
import { Assignment } from "../models/Assignment.js"
import { Substitute } from "../models/Substitute.js"
import { Class } from "../models/Class.js"
import { Timetable } from "../models/Timetable.js"

import {
  authRequired,
  allowRoles,
  STAFF,
  STAFF_TEACHER,
} from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /teachers - Overview of teacher users & metrics
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const teachers = await User.find({ role: "teacher" }).sort({ fullName: 1 })
    const assignments = await Assignment.find()
    const classes = await Class.find()

    const result = teachers.map((teacher) => {
      const teacherObjIdStr = teacher._id.toString()

      const assignmentsOfTheTeacher = assignments.filter(
        (a) => a.teacherId.toString() === teacherObjIdStr,
      )
      const classTeacherOf = classes.find(
        (c) =>
          c.classTeacherId && c.classTeacherId.toString() === teacherObjIdStr,
      )

      const pub = teacher.toObject()

      return {
        ...pub,
        classCount: new Set(
          assignmentsOfTheTeacher.map((a) => a.classId.toString()),
        ).size,
        subjectCount: new Set(
          assignmentsOfTheTeacher.map((a) => a.subjectId.toString()),
        ).size,
        assignmentCount: assignmentsOfTheTeacher.length,
        classTeacherOf: classTeacherOf
          ? `${classTeacherOf.name} ${classTeacherOf.section} (${classTeacherOf.academicYear})`
          : null,
      }
    })

    return res.json(result)
  } catch (err) {
    return next(err)
  }
})

//! GET /teachers/assignments - List assignments
router.get(
  "/assignments",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const query = {}
      if (req.query.teacherId && isValidObjectId(req.query.teacherId)) {
        query.teacherId = req.query.teacherId
      }
      if (req.query.classId && isValidObjectId(req.query.classId)) {
        query.classId = req.query.classId
      }

      const assignments = await Assignment.find(query)
      return res.json(assignments)
    } catch (err) {
      return next(err)
    }
  },
)

//! POST /teachers/assignments - Create assignment
router.post("/assignments", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { teacherId, classId, subjectId } = req.body

    if (!teacherId || !classId || !subjectId) {
      return res
        .status(400)
        .json({ error: "Teacher, class, and subject are required" })
    }

    if (
      !isValidObjectId(teacherId) ||
      !isValidObjectId(classId) ||
      !isValidObjectId(subjectId)
    ) {
      return res.status(400).json({ error: "Invalid ID format provided" })
    }

    const duplicateAssignment = await Assignment.findOne({
      teacherId,
      classId,
      subjectId,
    })
    if (duplicateAssignment) {
      return res.status(400).json({ error: "This assignment already exists" })
    }

    const assignment = await Assignment.create({
      teacherId,
      classId,
      subjectId,
    })
    return res.status(201).json(assignment)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /teachers/assignments/:id
router.delete(
  "/assignments/:id",
  allowRoles(...STAFF),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid assignment ID format" })
      }

      const deleted = await Assignment.findByIdAndDelete(req.params.id)
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" })
      }

      return res.json({ ok: true })
    } catch (err) {
      return next(err)
    }
  },
)

//! GET /teachers/substitutes - List substitutes
router.get(
  "/substitutes",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const query = {}
      if (req.query.date) {
        query.date = String(req.query.date)
      }

      const substitutes = await Substitute.find(query).sort({ date: -1 })
      return res.json(substitutes)
    } catch (err) {
      return next(err)
    }
  },
)

//! GET /teachers/substitutes/periods - Find teacher periods
router.get(
  "/substitutes/periods",
  allowRoles(...STAFF),
  async (req, res, next) => {
    try {
      const { teacherId, day } = req.query
      if (!teacherId) {
        return res.status(400).json({ error: "Teacher ID is required" })
      }

      const timetables = await Timetable.find()
      const periods = []

      for (const tt of timetables) {
        for (const p of tt.periods) {
          const pTeacherIdStr = p.teacherId ? p.teacherId.toString() : ""
          if (pTeacherIdStr === String(teacherId) && (!day || p.day === day)) {
            periods.push({
              ...(p.toObject ? p.toObject() : p),
              classId: tt.classId,
            })
          }
        }
      }

      return res.json(periods)
    } catch (err) {
      return next(err)
    }
  },
)

//! POST /teachers/substitutes - Allocate substitute
router.post("/substitutes", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const {
      absentTeacherId,
      substituteTeacherId,
      date,
      periodId,
      classId,
      subjectId,
      remarks,
    } = req.body

    if (!absentTeacherId || !substituteTeacherId || !date) {
      return res.status(400).json({
        error: "Absent teacher, substitute teacher and date are required",
      })
    }

    if (
      !isValidObjectId(absentTeacherId) ||
      !isValidObjectId(substituteTeacherId)
    ) {
      return res.status(400).json({ error: "Invalid teacher ID format" })
    }

    const substitute = await Substitute.create({
      absentTeacherId,
      substituteTeacherId,
      date: String(date),
      periodId: periodId ? String(periodId) : "",
      classId: classId && isValidObjectId(classId) ? classId : undefined,
      subjectId:
        subjectId && isValidObjectId(subjectId) ? subjectId : undefined,
      remarks: remarks ? String(remarks) : "",
      status: "allocated",
    })

    return res.status(201).json(substitute)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /teachers/substitutes/:id
router.delete(
  "/substitutes/:id",
  allowRoles(...STAFF),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid substitute ID format" })
      }

      const deleted = await Substitute.findByIdAndDelete(req.params.id)
      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Substitute allocation not found" })
      }

      return res.json({ ok: true })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
