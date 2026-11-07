// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Logbook } from "../models/Logbook.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"

const router = Router()

// Require authentication for all logbook endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/logbook - List all logbook entries
router.get("/", async (req, res, next) => {
  try {
    const logbookEntries = await Logbook.find().sort({ date: -1 }).lean()
    return res.json(logbookEntries)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/logbook/:id - Get a logbook entry by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid logbook ID format" })
    }

    const item = await Logbook.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "Logbook entry not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/logbook - Create a new logbook entry
router.post("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const {
      teacherName,
      classId,
      subjectId,
      date,
      topicCovered,
      homeworkGiven,
      remarks,
    } = req.body

    // Validate teacherName
    if (typeof teacherName !== "string" || !teacherName.trim()) {
      return res.status(400).json({
        error: "Teacher name is required",
      })
    }

    // Validate classId
    if (!classId) {
      return res.status(400).json({
        error: "Class ID is required",
      })
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).json({
        error: "Invalid class ID format",
      })
    }

    // Validate subjectId
    if (!subjectId) {
      return res.status(400).json({
        error: "Subject ID is required",
      })
    }

    if (!isValidObjectId(subjectId)) {
      return res.status(400).json({
        error: "Invalid subject ID format",
      })
    }

    // Validate date
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Check whether date is a real calendar date
    const [year, month, day] = date.split("-").map(Number)
    const parsedDate = new Date(Date.UTC(year, month - 1, day))
    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      return res.status(400).json({
        error: "Invalid date",
      })
    }

    // Validate that date is not in the past
    const today = new Date().toISOString().slice(0, 10)
    if (date < today) {
      return res.status(400).json({
        error: "PTM date cannot be in the past",
      })
    }

    // Validate topicCovered
    if (typeof topicCovered !== "string" || !topicCovered.trim()) {
      return res.status(400).json({
        error: "Topic covered is required",
      })
    }

    // Validate optional fields
    if (typeof homeworkGiven !== "string") {
      return res.status(400).json({
        error: "Homework given must be a string",
      })
    }

    if (typeof remarks !== "string") {
      return res.status(400).json({
        error: "Remarks must be a string",
      })
    }

    // Create only validated fields
    const logbookEntry = await Logbook.create({
      teacherName: teacherName.trim(),
      classId,
      subjectId,
      date,
      topicCovered: topicCovered.trim(),
      homeworkGiven: homeworkGiven?.trim() || "",
      remarks: remarks?.trim() || "",
    })

    return res.status(201).json(logbookEntry)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/logbook/:id - Update logbook entry details

router.put("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { id } = req.params

    // Validate logbook ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid logbook ID format",
      })
    }

    const {
      teacherName,
      classId,
      subjectId,
      date,
      topicCovered,
      homeworkGiven,
      remarks,
    } = req.body

    // Prevent updating _id
    const body = {}

    // Validate teacherName
    if (teacherName !== undefined) {
      if (typeof teacherName !== "string" || !teacherName.trim()) {
        return res.status(400).json({
          error: "Teacher name is required",
        })
      }

      body.teacherName = teacherName.trim()
    }

    // Validate classId
    if (classId !== undefined) {
      if (!classId) {
        return res.status(400).json({
          error: "Class ID is required",
        })
      }

      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          error: "Invalid class ID format",
        })
      }

      body.classId = classId
    }

    // Validate subjectId
    if (subjectId !== undefined) {
      if (!subjectId) {
        return res.status(400).json({
          error: "Subject ID is required",
        })
      }

      if (!isValidObjectId(subjectId)) {
        return res.status(400).json({
          error: "Invalid subject ID format",
        })
      }

      body.subjectId = subjectId
    }

    // Validate date
    if (date !== undefined) {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          error: "Date must be in YYYY-MM-DD format",
        })
      }

      // Validate that the date is a real calendar date
      const [year, month, day] = date.split("-").map(Number)
      const parsedDate = new Date(Date.UTC(year, month - 1, day))
      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        return res.status(400).json({
          error: "Invalid date",
        })
      }

      // Validate that date is not in the past
      const today = new Date().toISOString().slice(0, 10)

      if (date < today) {
        return res.status(400).json({
          error: "PTM date cannot be in the past",
        })
      }

      body.date = date
    }

    // Validate topicCovered
    if (topicCovered !== undefined) {
      if (typeof topicCovered !== "string" || !topicCovered.trim()) {
        return res.status(400).json({
          error: "Topic covered is required",
        })
      }

      body.topicCovered = topicCovered.trim()
    }

    // Validate homeworkGiven
    if (homeworkGiven !== undefined) {
      if (typeof homeworkGiven !== "string") {
        return res.status(400).json({
          error: "Homework given must be a string",
        })
      }

      body.homeworkGiven = homeworkGiven.trim()
    }

    // Validate remarks
    if (remarks !== undefined) {
      if (typeof remarks !== "string") {
        return res.status(400).json({
          error: "Remarks must be a string",
        })
      }

      body.remarks = remarks.trim()
    }

    const updated = await Logbook.findByIdAndUpdate(
      id,
      { $set: body },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Logbook entry not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/logbook/:id - Delete logbook entry
router.delete("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid logbook ID format" })
    }

    const deleted = await Logbook.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "Logbook entry not found" })
    }
    
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
