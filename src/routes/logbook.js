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
    let execQuery = Logbook.find(query).sort({ date: -1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const logbookEntries = await execQuery.lean()
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
    const logbookEntry = await Logbook.create(req.body)
    return res.status(201).json(logbookEntry)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/logbook/:id - Replace logbook entry details
router.put("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid logbook ID format" })
    }
    let body = { ...req.body }
    delete body._id
    const updated = await Logbook.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true },
    ).lean()

    if (!updated) {
      return res.status(404).json({ error: "Logbook entry not found" })
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
