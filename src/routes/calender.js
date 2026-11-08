// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Calendar } from "../models/Calendar.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()

// Require authentication for all calendar endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/calendar - List all calendar events/entries
router.get("/", async (req, res, next) => {
  try {
    const calendarEntries = await Calendar.find().sort({ date: 1 }).lean()

    return res.json(calendarEntries)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/calendar/:id - Get calendar entry by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid calendar entry ID format" })
    }

    const item = await Calendar.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "Calendar entry not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/calendar - Create a new calendar entry

router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { title, type, date, description } = req.body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Event title is required",
      })
    }

    // Validate type
    const allowedTypes = ["holiday", "event", "exam", "meeting", "other"]

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        error: "Invalid event type",
      })
    }

    // Validate date
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Validate that the date is a real calendar date
    const [year, month, day] = date.split("-").map(Number)
    const parsedDate = new Date(year, month - 1, day)

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return res.status(400).json({ error: "Invalid calendar date" })
    }

    // Validate that date is not in the past
    const today = new Date().toISOString().slice(0, 10)

    if (date < today) {
      return res.status(400).json({
        error: "PTM date cannot be in the past",
      })
    }

    // Validate description
    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        error: "Description must be a string",
      })
    }

    const calendarEntry = await Calendar.create({
      title: title.trim(),
      type,
      date,
      description: description?.trim() || "",
    })

    return res.status(201).json(calendarEntry)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/calendar/:id - Update calendar entry details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid calendar entry ID format",
      })
    }

    const { title, type, date, description } = req.body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "Event title is required",
      })
    }

    // Validate type
    const allowedTypes = ["holiday", "event", "exam", "meeting", "other"]

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        error: "Invalid event type",
      })
    }

    // Validate date
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Validate description
    if (description !== undefined && typeof description !== "string") {
      return res.status(400).json({
        error: "Description must be a string",
      })
    }

    const body = {
      title: title.trim(),
      type,
      date,
      description: description?.trim() || "",
    }

    const updated = await Calendar.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Calendar entry not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/calendar/:id - Delete calendar entry
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid calendar entry ID format" })
    }

    const deleted = await Calendar.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "Calendar entry not found" })
    }
    
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
