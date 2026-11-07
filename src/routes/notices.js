// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Notice } from "../models/Notice.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()

// Require authentication for all notice endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/notices - List all notices
router.get("/", async (req, res, next) => {
  try {
    const notices = await Notice.find().sort({ date: -1 }).lean()
    return res.json(notices)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/notices/:id - Get a notice by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid notice ID format" })
    }

    const item = await Notice.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "Notice not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/notices - Create a new notice
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { title, content, date, status, audience } = req.body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required" })
    }

    // Validate content
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required" })
    }

    // Validate date
    if (typeof date !== "string" || !date.trim()) {
      return res.status(400).json({ error: "Date is required" })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ error: "Date must be in YYYY-MM-DD format" })
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

    // Validate status
    const allowedStatuses = ["draft", "published", "archived"]

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    // Validate audience
    const allowedAudiences = ["all", "students", "teachers", "parents", "staff"]

    if (!allowedAudiences.includes(audience)) {
      return res.status(400).json({ error: "Invalid audience" })
    }

    const notice = await Notice.create({
      title: title.trim(),
      content: content.trim(),
      date,
      status,
      audience,
      postedBy: req.user.fullName,
    })

    return res.status(201).json(notice)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/notices/:id - Update notice details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    // Validate notice ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid notice ID format" })
    }

    const { title, content, date, status, audience } = req.body

    // Validate title
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title is required" })
    }

    // Validate content
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Content is required" })
    }

    // Validate date
    if (typeof date !== "string" || !date.trim()) {
      return res.status(400).json({ error: "Date is required" })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ error: "Date must be in YYYY-MM-DD format" })
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

    // Validate status
    const allowedStatuses = ["draft", "published", "archived"]

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" })
    }

    // Validate audience
    const allowedAudiences = ["all", "students", "teachers", "parents", "staff"]

    if (!allowedAudiences.includes(audience)) {
      return res.status(400).json({ error: "Invalid audience" })
    }

    // Only allow fields that can be updated
    const updateData = {
      title: title.trim(),
      content: content.trim(),
      date,
      status,
      audience,
    }

    const updated = await Notice.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({ error: "Notice not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/notices/:id - Delete notice
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid notice ID format" })
    }

    const deleted = await Notice.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "Notice not found" })
    }
    
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
