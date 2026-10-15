// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Complaint } from "../models/Complaint.js"
// middleware imports
import { authRequired, allowRoles, ALL_ROLES } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/complaints - Find all matching complaints
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
    let execQuery = Complaint.find(query).sort({ createdAt: -1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const complaints = await execQuery.lean()
    return res.json(complaints)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/complaints/:id - Find single complaint by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid complaint ID format" })
    }
    const complaint = await Complaint.findById(req.params.id).lean()
    if (!complaint)
      return res.status(404).json({ error: "Complaint not found" })
    return res.json(complaint)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/complaints - Create complaint
router.post("/", allowRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    const complaint = await Complaint.create(req.body)
    return res.status(201).json(complaint)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/complaints/:id - Update complaint by ID
router.put("/:id", allowRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid complaint ID format" })
    }
    let body = { ...req.body }
    delete body._id
    const updated = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true },
    ).lean()
    if (!updated) return res.status(404).json({ error: "Complaint not found" })
    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/complaints/:id - Delete complain by ID
router.delete("/:id", allowRoles(...ALL_ROLES), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid complaint ID format" })
    }
    const deleted = await Complaint.findByIdAndDelete(req.params.id).lean()
    if (!deleted) {
      return res.status(404).json({ error: "Complaint not found" })
    }
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
