// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Ptm } from "../models/Ptm.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { ptmCreateSchema } from "../schema/ptm.schema.js"

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
router.post(
  "/",
  allowRoles(...STAFF_TEACHER),
  SchemaValidation(ptmCreateSchema),
  async (req, res, next) => {
    try {
      const body = req.body

      const { title, date, slots, classIds, status, notes } = body

      // Prevent duplicate class IDs
      const uniqueClassIds = new Set(classIds.map(String))

      if (uniqueClassIds.size !== classIds.length) {
        return res.status(400).json({
          error: "Duplicate class IDs are not allowed",
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
  },
)

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

    const updateData = {}

    // Update only provided fields
    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      updateData.title = body.title.trim()
    }

    // Validate date
    if (Object.prototype.hasOwnProperty.call(body, "date")) {
      updateData.date = date
    }

    // Validate slots
    if (Object.prototype.hasOwnProperty.call(body, "slots")) {
      updateData.slots = body.slots.trim()
    }

    // Validate classIds
    if (Object.prototype.hasOwnProperty.call(body, "classIds")) {
      const classIds = body.classIds

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
      updateData.status = body.status
    }

    // Validate notes
    if (Object.prototype.hasOwnProperty.call(body, "notes")) {
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
