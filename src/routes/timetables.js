// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Timetable } from "../models/Timetable.js"
import { Class } from "../models/Class.js"
import { Subject } from "../models/Subject.js"
import { User } from "../models/User.js"
// middleware imports
import {
  authRequired,
  allowRoles,
  STAFF,
} from "../middleware/auth.js"

const router = Router()

// Require authentication for all timetable endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/timetables/:classId - Get timetable by classId
router.get("/:classId", async (req, res, next) => {
  try {
    const { classId } = req.params

    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        error: "Invalid class ID",
      })
    }

    const classExists = await Class.findOne({ _id: classId })

    if (!classExists) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    const doc = await Timetable.findOne({ classId }).lean()

    // If class exists but timetable hasn't been created yet
    return res.json(
      doc || {
        classId,
        periods: [],
      },
    )
  } catch (err) {
    return next(err)
  }
})

//! POST /api/timetables/:classId - Create or update timetable for a particular class
router.post("/:classId", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { classId } = req.params
    const { timetableId, periods } = req.body

    // Validate classId
    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        error: "Invalid class ID",
      })
    }

    // Verify that the class exists
    const classExists = await Class.findOne({ _id: classId })

    if (!classExists) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    // periods must be an array
    if (!Array.isArray(periods)) {
      return res.status(400).json({
        error: "Periods must be an array",
      })
    }

    // A timetable must contain at least one period
    if (periods.length === 0) {
      return res.status(400).json({
        error: "At least one timetable period is required",
      })
    }

    // Validate timetableId when supplied
    if (timetableId && !isValidObjectId(timetableId)) {
      return res.status(400).json({
        error: "Invalid timetable ID",
      })
    }

    // Check duplicate day + period combinations
    const slotKeys = periods.map((item) => `${item.day}-${item.period}`)

    const uniqueSlotKeys = new Set(slotKeys)

    if (uniqueSlotKeys.size !== slotKeys.length) {
      return res.status(400).json({
        error: "Duplicate timetable period found for the same day",
      })
    }

    // Collect subject and teacher IDs
    const subjectIds = [
      ...new Set(
        periods
          .map((item) => item.subjectId)
          .filter(Boolean)
          .map(String),
      ),
    ]

    const teacherIds = [
      ...new Set(
        periods
          .map((item) => item.teacherId)
          .filter(Boolean)
          .map(String),
      ),
    ]

    // Validate subject IDs
    if (subjectIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({
        error: "Invalid subject ID",
      })
    }

    // Validate teacher IDs
    if (teacherIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({
        error: "Invalid teacher ID",
      })
    }

    // Fetch all referenced subjects
    const subjects = await Subject.find({
      _id: { $in: subjectIds },
    })
      .select("_id name classIds")
      .lean()

    // Make subject lookup efficient
    const subjectMap = new Map(
      subjects.map((subject) => [String(subject._id), subject]),
    )

    // Make sure every subject exists
    for (const subjectId of subjectIds) {
      if (!subjectMap.has(subjectId)) {
        return res.status(400).json({
          error: `Subject not found: ${subjectId}`,
        })
      }
    }

    // Make sure subjects belong to the selected class
    for (const subjectId of subjectIds) {
      const subject = subjectMap.get(subjectId)

      if (
        Array.isArray(subject.classIds) &&
        !subject.classIds.some((id) => String(id) === String(classId))
      ) {
        return res.status(400).json({
          error: `Subject "${subject.name}" does not belong to the selected class`,
        })
      }
    }

    // Fetch all referenced teachers
    const teachers = await User.find({
      _id: { $in: teacherIds },
      role: "teacher",
    })
      .select("_id fullName")
      .lean()

    // Make teacher lookup efficient
    const teacherMap = new Map(
      teachers.map((teacher) => [String(teacher._id), teacher]),
    )

    // Make sure every teacher exists
    for (const teacherId of teacherIds) {
      if (!teacherMap.has(teacherId)) {
        return res.status(400).json({
          error: `Teacher not found: ${teacherId}`,
        })
      }
    }

    // Build trusted timetable periods
    const validatedPeriods = periods.map((period) => {
      const subject = period.subjectId
        ? subjectMap.get(String(period.subjectId))
        : null

      const teacher = period.teacherId
        ? teacherMap.get(String(period.teacherId))
        : null

      return {
        day: period.day,
        period: period.period,
        start: period.start,
        end: period.end,
        subjectId: subject?._id,
        subjectName: subject?.name || "Free",
        teacherId: teacher?._id,
        teacherName: teacher?.fullName || "",
      }
    })

    const payload = {
      classId,
      periods: validatedPeriods,
    }

    // CREATE
    if (!timetableId) {
      // Check whether a timetable already exists for this class
      const existingTimetable = await Timetable.findOne({
        classId,
      })

      if (existingTimetable) {
        return res.status(400).json({
          error: "Timetable already exists for this class",
        })
      }

      const doc = await Timetable.create(payload)

      return res.status(201).json(doc)
    }

    // UPDATE
    // Verify that the timetable being updated exists
    const timetableExists = await Timetable.findOne({
      _id: timetableId,
    })

    if (!timetableExists) {
      return res.status(404).json({
        error: "Timetable not found",
      })
    }

    // Check whether another timetable already uses this classId.
    // The current timetable being updated is excluded using $ne.
    const duplicateTimetable = await Timetable.findOne({
      classId,
      _id: { $ne: timetableId },
    })

    if (duplicateTimetable) {
      return res.status(400).json({
        error: "Another timetable already exists for this class",
      })
    }

    // Update the specified timetable
    const doc = await Timetable.findOneAndUpdate(
      {
        _id: timetableId,
        classId,
      },
      {
        $set: payload,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!doc) {
      return res.status(404).json({
        error: "Timetable not found for this class",
      })
    }

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/timetables/:id - Delete timetable
router.delete(
  "/:classId",
  allowRoles(...STAFF),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.classId)) {
        return res.status(400).json({ error: "Invalid classId format" })
      }

      const deleted = await Timetable.findOneAndDelete({
        classId: req.params.classId,
      }).lean()

      if (!deleted) {
        return res.status(404).json({ error: "Timetable not found" })
      }

      return res.json({ success: true, classId: req.params.classId })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
