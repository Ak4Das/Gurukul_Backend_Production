// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Class } from "../models/Class.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/classes - List all classes
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
    let execQuery = Class.find(query).sort({ name: 1, section: 1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const classes = await execQuery.lean()
    return res.json(classes)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/classes/:id - Get class by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid class ID format" })
    }
    const item = await Class.findById(req.params.id).lean()
    if (!item) {
      return res.status(404).json({ error: "Class not found" })
    }
    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/classes - Create new class
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { name, section, academicYear } = req.body

    // Check for duplicate class
    const duplicate = await Class.findOne({
      name,
      section,
      academicYear,
    }).lean()

    if (duplicate) {
      return res.status(400).json({
        error: `Class "${name} ${section} (${academicYear})" already exists`,
      })
    }

    const newClass = await Class.create({ status: "active", ...req.body })
    return res.status(201).json(newClass)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/classes/:id - Replace class details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid class ID format" })
    }

    const { name, section, academicYear } = req.body
    if (name && section && academicYear) {
      const duplicate = await Class.findOne({
        _id: { $ne: req.params.id },
        name,
        section,
        academicYear,
      }).lean()

      if (duplicate) {
        return res.status(400).json({
          error: `Class "${name} ${section} (${academicYear})" already exists`,
        })
      }
    }

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    ).lean()

    if (!updated) {
      return res.status(404).json({ error: "Class not found" })
    }
    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/classes/:id - Remove class
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid class ID format" })
    }
    const deleted = await Class.findByIdAndDelete(req.params.id).lean()
    if (!deleted) {
      return res.status(404).json({ error: "Class not found" })
    }
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
