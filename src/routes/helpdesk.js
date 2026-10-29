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
    const query = {}

    // Parse standard filter query params
    for (const [key, value] of Object.entries(req.query)) {
      if (["sort", "limit", "skip", "search", "searchFields"].includes(key))
        continue
      if (value !== undefined && value !== "") {
        if (value === "true") {
          query[key] = true
        } else if (value === "false") {
          query[key] = false
        } else {
          query[key] = value
        }
      }
    }

    // Regex Search across specified fields
    if (req.query.search && req.query.searchFields) {
      const searchTerm = String(req.query.search).trim()
      const fields = String(req.query.searchFields)
        .split(",")
        .map((field) => field.trim())

      if (searchTerm && fields.length > 0) {
        query.$or = fields.map((field) => ({
          [field]: { $regex: searchTerm, $options: "i" },
        }))
      }
    }

    // Build Mongoose query object
    // Model.find() builds a Query. The query executes when Mongoose gets an execution trigger such as await, .then(), or .exec().
    let execQuery = Helpdesk.find(query).sort({ createdAt: -1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const tickets = await execQuery.lean()
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
      const body = {
        subject: req.body.subject,
        description: req.body.description,
        category: req.body.category,
        priority: req.body.priority,

        // Always derived from authenticated user.
        raisedBy: req.user.username,
        role: req.user.role,

        // Always open when created.
        status: "open",

        // No staff member has handled it yet.
        assignedTo: "",
      }

      const ticket = await Helpdesk.create(body)

      return res.status(201).json(ticket)
    } catch (err) {
      return next(err)
    }
  },
)
//! PUT /api/helpdesk/:id - Replace helpdesk ticket details
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

      // Only status is accepted from the frontend.
      const update = {
        status: req.body.status,

        // Automatically record which staff member handled it.
        assignedTo: req.user.username,
      }

      const updated = await Helpdesk.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        {
          new: true,
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
