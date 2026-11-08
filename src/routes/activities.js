// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Activity } from "../models/Activity.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/activities - Find all matching activities
router.get("/", async (req, res, next) => {
  try {
    const activities = await Activity.find().sort({ date: -1 }).lean()
    return res.json(activities)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/activities/:id - Find single activity by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid activity ID format" })
    }

    const item = await Activity.findById(req.params.id).lean()

    if (!item) return res.status(404).json({ error: "Activity not found" })

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/activities - Create activity
router.post("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const { title, type, date, classIds, inCharge, status, description } =
      req.body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Activity title is required",
      })
    }

    // Validate type
    const allowedTypes = ["Sports", "Cultural", "Academic", "Community", "Club"]

    if (typeof type !== "string" || !allowedTypes.includes(type.trim())) {
      return res.status(400).json({
        error: "Invalid activity type",
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

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    if (!classIds.every((id) => isValidObjectId(id))) {
      return res.status(400).json({
        error: "All class IDs must be valid ObjectIds",
      })
    }

    // Validate inCharge
    if (typeof inCharge !== "string" || !inCharge.trim()) {
      return res.status(400).json({
        error: "In-charge name is required",
      })
    }

    // Validate status
    const allowedStatuses = [
      "scheduled",
      "in_progress",
      "completed",
      "cancelled",
    ]

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status.trim())
    ) {
      return res.status(400).json({
        error: "Invalid activity status",
      })
    }

    // Validate description
    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        error: "Description must be a string",
      })
    }

    const item = await Activity.create({
      title: title.trim(),
      type: type.trim(),
      date,
      classIds,
      inCharge: inCharge.trim(),
      status: status.trim(),
      description: description?.trim() ?? "",
    })

    return res.status(201).json(item)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/activities/:id - Update activity by ID
router.put("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    // Validate activity ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid activity ID format",
      })
    }

    const { title, type, date, classIds, inCharge, status, description } =
      req.body

    // Validate title if provided
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return res.status(400).json({
        error: "Activity title is required",
      })
    }

    // Validate type if provided
    const allowedTypes = ["Sports", "Cultural", "Academic", "Community", "Club"]

    if (
      type !== undefined &&
      (typeof type !== "string" || !allowedTypes.includes(type.trim()))
    ) {
      return res.status(400).json({
        error: "Invalid activity type",
      })
    }

    // Validate date if provided
    if (
      date !== undefined &&
      (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    ) {
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

    // Validate classIds if provided
    if (classIds !== undefined) {
      if (!Array.isArray(classIds) || classIds.length === 0) {
        return res.status(400).json({
          error: "At least one class is required",
        })
      }

      if (!classIds.every((id) => isValidObjectId(id))) {
        return res.status(400).json({
          error: "All class IDs must be valid ObjectIds",
        })
      }
    }

    // Validate inCharge if provided
    if (
      inCharge !== undefined &&
      (typeof inCharge !== "string" || !inCharge.trim())
    ) {
      return res.status(400).json({
        error: "In-charge name is required",
      })
    }

    // Validate status if provided
    const allowedStatuses = [
      "scheduled",
      "in_progress",
      "completed",
      "cancelled",
    ]

    if (
      status !== undefined &&
      (typeof status !== "string" || !allowedStatuses.includes(status.trim()))
    ) {
      return res.status(400).json({
        error: "Invalid activity status",
      })
    }

    // Validate description if provided
    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        error: "Description must be a string",
      })
    }

    // Build update object
    const body = {}

    if (title !== undefined) {
      body.title = title.trim()
    }
    if (type !== undefined) {
      body.type = type.trim()
    }
    if (date !== undefined) {
      body.date = date
    }
    if (classIds !== undefined) {
      body.classIds = classIds
    }
    if (inCharge !== undefined) {
      body.inCharge = inCharge.trim()
    }
    if (status !== undefined) {
      body.status = status.trim()
    }
    if (description !== undefined) {
      body.description = description.trim()
    }

    const updated = await Activity.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Activity not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/activities/:id - Delete activity by ID
router.delete("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid activity ID format" })
    }

    const deleted = await Activity.findByIdAndDelete(req.params.id).lean()

    if (!deleted) return res.status(404).json({ error: "Activity not found" })

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
