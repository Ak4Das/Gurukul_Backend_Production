// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Subject } from "../models/Subject.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/subjects - Find all subjects
router.get("/", async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 }).lean()
    return res.json(subjects)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/subjects/:id - Find single subject by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject ID format" })
    }

    const subject = await Subject.findById(req.params.id).lean()

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" })
    }

    return res.json(subject)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/subjects/ - Create subject
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { name, code, category, classIds, maxMarks, passingMarks } = req.body

    // Validate subject name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Subject name is required",
      })
    }

    // Validate subject code
    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "Subject code is required",
      })
    }

    // Validate category
    const allowedCategories = [
      "Core",
      "Elective",
      "Vocational",
      "Extracurricular",
      "General",
    ]

    if (category !== undefined && !allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid subject category",
      })
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    const invalidClassId = classIds.some((classId) => !isValidObjectId(classId))

    if (invalidClassId) {
      return res.status(400).json({
        error: "One or more class IDs are invalid",
      })
    }

    // Validate maxMarks
    if (typeof maxMarks !== "number" || maxMarks <= 0) {
      return res.status(400).json({
        error: "Maximum marks must be a positive number",
      })
    }

    // Validate passingMarks
    if (typeof passingMarks !== "number" || passingMarks <= 0) {
      return res.status(400).json({
        error: "Passing marks must be a positive number",
      })
    }

    // Passing marks cannot exceed maximum marks
    if (passingMarks > maxMarks) {
      return res.status(400).json({
        error: "Passing marks cannot exceed maximum marks",
      })
    }

    // Normalize code before duplicate check
    const normalizedCode = code.trim().toUpperCase()

    // Check duplicate subject code
    const existingSubject = await Subject.exists({
      code: normalizedCode,
    })

    if (existingSubject) {
      return res.status(409).json({
        error: "Subject code already exists",
      })
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: normalizedCode,
      category: category || "Core",
      classIds,
      maxMarks,
      passingMarks,
    })

    return res.status(201).json(subject)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/subjects/:id - Update subject by ID
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { id } = req.params

    // Validate subject ID
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        error: "Invalid subject ID format",
      })
    }

    const { name, code, category, classIds, maxMarks, passingMarks } = body

    // Validate subject name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Subject name is required",
      })
    }

    // Validate subject code
    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        error: "Subject code is required",
      })
    }

    // Validate category
    const allowedCategories = [
      "Core",
      "Elective",
      "Vocational",
      "Extracurricular",
      "General",
    ]

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid subject category",
      })
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    const invalidClassId = classIds.some((classId) => !isValidObjectId(classId))

    if (invalidClassId) {
      return res.status(400).json({
        error: "One or more class IDs are invalid",
      })
    }

    // Validate maxMarks
    if (typeof maxMarks !== "number" || maxMarks <= 0) {
      return res.status(400).json({
        error: "Maximum marks must be a positive number",
      })
    }

    // Validate passingMarks
    if (typeof passingMarks !== "number" || passingMarks < 0) {
      return res.status(400).json({
        error: "Passing marks must be a non-negative number",
      })
    }

    // Passing marks cannot exceed maximum marks
    if (passingMarks > maxMarks) {
      return res.status(400).json({
        error: "Passing marks cannot exceed maximum marks",
      })
    }

    // Normalize subject code
    const normalizedCode = code.trim().toUpperCase()

    // Check duplicate code excluding the current subject
    const existingSubject = await Subject.exists({
      code: normalizedCode,
      _id: { $ne: id },
    })

    if (existingSubject) {
      return res.status(409).json({
        error: "Subject code already exists",
      })
    }

    const updated = await Subject.findByIdAndUpdate(
      id,
      {
        $set: {
          name: name.trim(),
          code: normalizedCode,
          category,
          classIds,
          maxMarks,
          passingMarks,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Subject not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/subjects/:id - Delete subject by ID
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject ID format" })
    }

    const deleted = await Subject.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "Subject not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
