// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Ptm } from "../models/Ptm.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"

const router = Router()

// Require authentication for all PTM endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/ptm - List all PTM schedules/records
router.get("/", async (req, res, next) => {
  try {
    const ptmRecords = await Ptm.find().sort({ date: -1 }).lean()
    return res.json(ptmRecords)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/ptm/:id - Get a PTM record by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid PTM record ID format" })
    }

    const item = await Ptm.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "PTM record not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/ptm - Create a new PTM schedule/record
router.post("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const body = req.body

    const { title, date, slots, classIds, status, notes } = body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Title is required and must be a non-empty string",
      })
    }

    // Validate date
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Validate that the date is an actual calendar date
    const [year, month, day] = date.split("-").map(Number)
    const parsedDate = new Date(Date.UTC(year, month - 1, day))

    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      return res.status(400).json({
        error: "Invalid calendar date",
      })
    }

    // Validate that PTM date is not in the past
    const today = new Date().toISOString().slice(0, 10)

    if (date < today) {
      return res.status(400).json({
        error: "PTM date cannot be in the past",
      })
    }

    // Validate slots
    if (typeof slots !== "string" || !slots.trim()) {
      return res.status(400).json({
        error: "Slots are required and must be a non-empty string",
      })
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    // Validate every class ID
    if (classIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({
        error: "One or more class IDs are invalid",
      })
    }

    // Prevent duplicate class IDs
    const uniqueClassIds = new Set(classIds.map(String))

    if (uniqueClassIds.size !== classIds.length) {
      return res.status(400).json({
        error: "Duplicate class IDs are not allowed",
      })
    }

    // Validate status
    const allowedStatuses = ["scheduled", "completed", "cancelled"]

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Status must be one of: scheduled, completed, cancelled",
      })
    }

    // Validate notes
    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({
        error: "Notes are required and must be a non-empty string",
      })
    }

    // Verify that all referenced classes exist
    const classCount = await mongoose.model("Class").countDocuments({
      _id: { $in: classIds },
    })

    if (classCount !== classIds.length) {
      return res.status(400).json({
        error: "One or more referenced classes do not exist",
      })
    }

    // Create only validated fields
    const ptmRecord = await Ptm.create({
      title: title.trim(),
      date,
      slots: slots.trim(),
      classIds,
      status,
      notes: notes.trim(),
    })

    return res.status(201).json(ptmRecord)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/ptm/:id - Update only provided PTM fields

router.put("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { id } = req.params

    // Validate PTM record ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid PTM record ID format",
      })
    }

    const body = req.body

    // Allowed fields
    const allowedFields = [
      "title",
      "date",
      "slots",
      "classIds",
      "status",
      "notes",
    ]

    // Reject unknown fields
    const unknownFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field),
    )

    if (unknownFields.length > 0) {
      return res.status(400).json({
        error: `Unknown field(s): ${unknownFields.join(", ")}`,
      })
    }

    const updateData = {}

    // Validate only changed/provided fields

    // Validate title
    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return res.status(400).json({
          error: "Title must be a non-empty string",
        })
      }

      updateData.title = body.title.trim()
    }

    // Validate date
    if (Object.prototype.hasOwnProperty.call(body, "date")) {
      const date = body.date

      // Validate date format
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          error: "Date must be in YYYY-MM-DD format",
        })
      }

      // Validate actual calendar date
      const [year, month, day] = date.split("-").map(Number)

      const parsedDate = new Date(Date.UTC(year, month - 1, day))

      if (
        parsedDate.getUTCFullYear() !== year ||
        parsedDate.getUTCMonth() !== month - 1 ||
        parsedDate.getUTCDate() !== day
      ) {
        return res.status(400).json({
          error: "Invalid calendar date",
        })
      }

      // PTM date must not be in the past
      const today = new Date().toISOString().slice(0, 10)

      if (date < today) {
        return res.status(400).json({
          error: "PTM date cannot be in the past",
        })
      }

      updateData.date = date
    }

    // Validate slots
    if (Object.prototype.hasOwnProperty.call(body, "slots")) {
      if (typeof body.slots !== "string" || !body.slots.trim()) {
        return res.status(400).json({
          error: "Slots must be a non-empty string",
        })
      }

      updateData.slots = body.slots.trim()
    }

    // Validate classIds
    if (Object.prototype.hasOwnProperty.call(body, "classIds")) {
      const classIds = body.classIds

      if (!Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({
          error: "At least one class is required",
        })
      }

      // Validate every class ID
      if (classIds.some((classId) => !isValidObjectId(classId))) {
        return res.status(400).json({
          error: "One or more class IDs are invalid",
        })
      }

      // Prevent duplicate class IDs
      const uniqueClassIds = new Set(classIds.map(String))

      if (uniqueClassIds.size !== classIds.length) {
        return res.status(400).json({
          error: "Duplicate class IDs are not allowed",
        })
      }

      // Verify referenced classes exist
      const classCount = await Class.countDocuments({
        _id: { $in: classIds },
      })

      if (classCount !== classIds.length) {
        return res.status(400).json({
          error: "One or more referenced classes do not exist",
        })
      }

      updateData.classIds = classIds
    }

    // Validate status
    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const allowedStatuses = ["scheduled", "completed", "cancelled"]

      if (!allowedStatuses.includes(body.status)) {
        return res.status(400).json({
          error: "Status must be one of: scheduled, completed, cancelled",
        })
      }

      updateData.status = body.status
    }

    // Validate notes
    if (Object.prototype.hasOwnProperty.call(body, "notes")) {
      if (typeof body.notes !== "string" || !body.notes.trim()) {
        return res.status(400).json({
          error: "Notes must be a non-empty string",
        })
      }

      updateData.notes = body.notes.trim()
    }

    // At least one field must be provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "At least one valid field is required for update",
      })
    }

    // Update only validated fields
    const updated = await Ptm.findByIdAndUpdate(
      id,
      {
        $set: updateData,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "PTM record not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/ptm/:id - Delete PTM record
router.delete("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid PTM record ID format" })
    }

    const deleted = await Ptm.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "PTM record not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
