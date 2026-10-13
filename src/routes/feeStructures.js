// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { FeeStructure } from "../models/FeeStructure.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()

// Require authentication for all fee structure endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/fee-structures - List all fee structures
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
    let execQuery = FeeStructure.find(query).sort({ name: 1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const feeStructures = await execQuery.lean()

    return res.json(feeStructures)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/fee-structures/:id - Get fee structure by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid fee structure ID format" })
    }
    const item = await FeeStructure.findById(req.params.id).lean()
    if (!item) {
      return res.status(404).json({ error: "Fee structure not found" })
    }
    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/fee-structures - Create a new fee structure
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const feeStructure = await FeeStructure.create(req.body)
    return res.status(201).json(feeStructure)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/fee-structures/:id - Replace fee structure details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid fee structure ID format" })
    }
    let body = { ...req.body }
    delete body._id
    const updated = await FeeStructure.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true },
    ).lean()

    if (!updated) {
      return res.status(404).json({ error: "Fee structure not found" })
    }
    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/fee-structures/:id - Delete fee structure
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid fee structure ID format" })
    }
    const deleted = await FeeStructure.findByIdAndDelete(req.params.id).lean()
    if (!deleted) {
      return res.status(404).json({ error: "Fee structure not found" })
    }
    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
