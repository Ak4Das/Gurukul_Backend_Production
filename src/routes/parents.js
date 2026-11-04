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

//! GET /api/parents - Filtering, sorting and pagination
router.get("/", async (req, res, next) => {
  try {
    // If no query parameters are provided, return the entire collection.
    if (Object.keys(req.query).length === 0) {
      const parents = await Parent.find().sort({ name: 1 }).lean()

      return res.json(parents)
    }

    // 1. Extract query parameters
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "name",
      sortOrder = "asc",
    } = req.query

    // 2. Validate pagination parameters
    const pageNumber = Number(page)
    const pageSize = Number(limit)

    const allowedPageSizes = [10, 25, 50, 100]

    if (pageNumber < 1 || !allowedPageSizes.includes(pageSize)) {
      return res.status(400).json({
        error: "Invalid pagination parameters",
      })
    }

    // 3. Whitelist sortable fields
    const allowedSortFields = [
      "name",
      "relation",
      "mobile",
      "email",
      "occupation",
      "status",
    ]

    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        error: "Invalid sort field",
      })
    }

    if (!["asc", "desc"].includes(sortOrder)) {
      return res.status(400).json({
        error: "Invalid sort order",
      })
    }

    // 4. Build the search filter
    const filter = {}
    const searchTerm = String(search).trim()

    if (searchTerm) {
      // Escape regex special characters so search input is treated
      // as literal text rather than an arbitrary regular expression.
      const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

      const searchRegex = new RegExp(escapedSearch, "i")

      filter.$or = [
        { name: searchRegex },
        { relation: searchRegex },
        { mobile: searchRegex },
        { email: searchRegex },
        { occupation: searchRegex },
        { address: searchRegex },
        { status: searchRegex },
      ]
    }

    // 5. Calculate sorting and pagination
    const sort = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
    }

    const skip = (pageNumber - 1) * pageSize

    // 6. Execute database queries in parallel
    const [parents, total] = await Promise.all([
      Parent.find(filter).sort(sort).skip(skip).limit(pageSize).lean(),

      Parent.countDocuments(filter),
    ])

    const totalPages = Math.ceil(total / pageSize)

    // 7. Return paginated response
    return res.json({
      data: parents,
      pagination: {
        total,
        page: total === 0 ? 1 : Math.min(pageNumber, totalPages),
        limit: pageSize,
        totalPages,
      },
    })
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
      { returnDocument: "after", runValidators: true },
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
