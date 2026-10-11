// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Parent } from "../models/Parent.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/parents - Find all matching parents
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
    let execQuery = Parent.find(query).sort({ name: 1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const parents = await execQuery.lean()

    return res.json(parents)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/parents/:id - Find single parent by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid parent ID format" })
    }
    const parent = await Parent.findById(req.params.id).lean()
    if (!parent) {
      return res.status(404).json({ error: "Parent not found" })
    }
    return res.json(parent)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/parents - Create parent
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const parent = await Parent.create(req.body)
    return res.status(201).json(parent)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/parents/:id - Update parent by ID
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid parent ID format" })
    }
    let body = { ...req.body }
    delete body._id
    const updated = await Parent.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true },
    ).lean()
    if (!updated) {
      return res.status(404).json({ error: "Parent not found" })
    }
    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/parents/:id - Delete parent by ID
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid parent ID format" })
    }
    const deleted = await Parent.findByIdAndDelete(req.params.id).lean()
    if (!deleted) {
      return res.status(404).json({ error: "Parent not found" })
    }
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
