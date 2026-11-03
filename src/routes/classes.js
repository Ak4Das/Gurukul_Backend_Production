// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Class } from "../models/Class.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

// Fields that clients are allowed to create or update.
const WRITABLE_FIELDS = [
  "name",
  "section",
  "academicYear",
  "status",
  "capacity",
  "room",
]

// Extract only explicitly permitted fields.
function pickFields(source, allowedFields) {
  const result = {}

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field]
    }
  }

  return result
}

// Validate MongoDB ObjectId strings.
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/classes - List all classes
router.get("/", async (req, res, next) => {
  try {
    const classes = await Class.find({}).sort({ name: 1, section: 1 }).lean()

    return res.json(classes)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/classes/:id - Get class by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid class ID format",
      })
    }

    const item = await Class.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/classes - Create new class
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const input = pickFields(req.body, WRITABLE_FIELDS)

    const { name, section, academicYear } = input

    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      typeof input.section !== "string" ||
      !input.section.trim() ||
      typeof input.academicYear !== "string" ||
      !input.academicYear.trim()
    ) {
      return res.status(400).json({
        error: "Name, section, and academic year are required",
      })
    }

    // Check whether this class combination already exists.
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

    // The Class schema defaults status to "active"
    // when the request doesn't provide a status.
    const newClass = await Class.create(input)

    return res.status(201).json(newClass)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/classes/:id - Replace class details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid class ID format",
      })
    }

    const updates = pickFields(req.body, WRITABLE_FIELDS)

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No valid fields provided for update",
      })
    }

    // Retrieve the existing class.
    const existing = await Class.findById(req.params.id).lean()

    if (!existing) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    // Determine the final values after applying the updates.
    const finalName = updates.name ?? existing.name

    const finalSection = updates.section ?? existing.section

    const finalAcademicYear = updates.academicYear ?? existing.academicYear

    // Check for another class with the same combination.
    const duplicate = await Class.findOne({
      _id: { $ne: existing._id },
      name: finalName,
      section: finalSection,
      academicYear: finalAcademicYear,
    }).lean()

    if (duplicate) {
      return res.status(400).json({
        error: `Class "${finalName} ${finalSection} (${finalAcademicYear})" already exists`,
      })
    }

    const updated = await Class.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/classes/:id - Remove class
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid class ID format",
      })
    }

    const deleted = await Class.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({
        error: "Class not found",
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
