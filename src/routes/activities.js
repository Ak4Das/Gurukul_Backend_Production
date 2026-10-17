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
    let execQuery = Activity.find(query).sort({ date: -1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const activities = await execQuery.lean()
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
    const item = await Activity.create(req.body)
    return res.status(201).json(item)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/activities/:id - Update activity by ID
router.put("/:id", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid activity ID format" })
    }
    let body = { ...req.body }
    delete body._id
    const updated = await Activity.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true },
    ).lean()
    if (!updated) return res.status(404).json({ error: "Activity not found" })
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
