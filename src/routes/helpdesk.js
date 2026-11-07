// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Helpdesk } from "../models/Helpdesk.js"
// middleware imports
import {
  authRequired,
  allowRoles,
  ALL_ROLES,
  STAFF,
} from "../middleware/auth.js"

const router = Router()

// Require authentication for all helpdesk endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/helpdesk - List all helpdesk tickets
router.get("/", async (req, res, next) => {
  try {
    const tickets = await Helpdesk.find().sort({ createdAt: -1 }).lean()
    return res.json(tickets)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/helpdesk/:id - Get a helpdesk ticket by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res
        .status(400)
        .json({ error: "Invalid helpdesk ticket ID format" })
    }

    const item = await Helpdesk.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "Helpdesk ticket not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/helpdesk - Create a new helpdesk ticket
router.post(
  "/",
  allowRoles("student", "parent", "teacher"),
  async (req, res, next) => {
    try {
      const { subject, description, category, priority } = req.body

      // Validate subject
      if (typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({
          error: "Subject is required",
        })
      }

      // Validate description
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({
          error: "Description is required",
        })
      }

      // Validate category
      const allowedCategories = [
        "Academic",
        "Fees & Finance",
        "Transport",
        "IT & Portal",
        "Hostel",
        "General Query",
        "Other",
      ]

      if (category !== undefined && !allowedCategories.includes(category)) {
        return res.status(400).json({
          error: "Invalid helpdesk category",
        })
      }

      // Validate priority
      const allowedPriorities = ["low", "medium", "high", "urgent"]

      if (priority !== undefined && !allowedPriorities.includes(priority)) {
        return res.status(400).json({
          error: "Invalid helpdesk priority",
        })
      }

      const body = {
        subject: subject.trim(),
        description: description.trim(),
        category: category || "General Query",
        priority: priority || "medium",
        raisedBy: req.user.username,
        role: req.user.role,
        status: "open",
        assignedTo: "",
      }

      const ticket = await Helpdesk.create(body)

      return res.status(201).json(ticket)
    } catch (err) {
      return next(err)
    }
  },
)

//! PUT /api/helpdesk/:id - Update helpdesk ticket status
router.put(
  "/:id",
  allowRoles("admin", "clerk", "supervisor"),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res
          .status(400)
          .json({ error: "Invalid helpdesk ticket ID format" })
      }

      const { status } = req.body

      // Validate status
      const allowedStatuses = ["open", "in progress", "resolved", "closed"]

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error: "Invalid helpdesk ticket status",
        })
      }

      // Only status is accepted from the frontend.
      const update = {
        status,

        // Automatically record which staff member handled it.
        assignedTo: req.user.username,
      }

      const updated = await Helpdesk.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        {
          returnDocument: "after",
          runValidators: true,
        },
      ).lean()

      if (!updated) {
        return res.status(404).json({ error: "Helpdesk ticket not found" })
      }

      return res.json(updated)
    } catch (err) {
      return next(err)
    }
  },
)

//! DELETE /api/helpdesk/:id - Delete helpdesk ticket
router.delete(
  "/:id",
  allowRoles("admin", "clerk", "supervisor"),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res
          .status(400)
          .json({ error: "Invalid helpdesk ticket ID format" })
      }

      const ticket = await Helpdesk.findById(req.params.id)

      if (!ticket) {
        return res.status(404).json({ error: "Helpdesk ticket not found" })
      }

      if (ticket.status !== "closed") {
        return res.status(400).json({
          error: "Only closed complaints can be deleted",
        })
      }

      await Helpdesk.findByIdAndDelete(req.params.id)

      return res.json({ ok: true })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
