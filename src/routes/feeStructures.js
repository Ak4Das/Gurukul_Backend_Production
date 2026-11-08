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
    const feeStructures = await FeeStructure.find().sort({ name: 1 }).lean()

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
    const { name, category, frequency, classIds, status } = req.body

    // Validate name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Fee structure name is required",
      })
    }

    // Validate category
    const allowedCategories = [
      "tuition",
      "transport",
      "exam",
      "admission",
      "lab",
      "activity",
      "other",
    ]

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid fee category",
      })
    }

    // Validate frequency
    const allowedFrequencies = ["one time", "monthly", "quarterly", "annually"]

    if (frequency !== undefined && !allowedFrequencies.includes(frequency)) {
      return res.status(400).json({
        error: "Invalid frequency",
      })
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    // Validate each class entry
    const classIdsSet = new Set()

    for (const item of classIds) {
      if (!item || typeof item !== "object") {
        return res.status(400).json({
          error: "Each class entry must be an object",
        })
      }

      const { classId, amount } = item

      // Validate classId
      if (!classId) {
        return res.status(400).json({
          error: "Class ID is required",
        })
      }

      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          error: "Invalid class ID format",
        })
      }

      // Prevent duplicate classes
      if (classIdsSet.has(classId)) {
        return res.status(400).json({
          error: "Each class can only be added once",
        })
      }

      classIdsSet.add(classId)

      // Validate amount
      if (typeof amount !== "number" || amount < 0) {
        return res.status(400).json({
          error: "Amount must be a non-negative whole number",
        })
      }
    }

    // Validate status
    const allowedStatuses = ["active", "inactive"]

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      })
    }

    const feeStructure = await FeeStructure.create({
      name: name.trim(),
      category,
      frequency,
      classIds,
      status,
    })

    return res.status(201).json(feeStructure)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/fee-structures/:id - Replace fee structure details

router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid fee structure ID format",
      })
    }

    const { name, category, frequency, classIds, status } = req.body

    // Validate name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Fee structure name is required",
      })
    }

    // Validate category
    const allowedCategories = [
      "tuition",
      "transport",
      "exam",
      "admission",
      "lab",
      "activity",
      "other",
    ]

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid fee category",
      })
    }

    // Validate frequency
    const allowedFrequencies = ["one time", "monthly", "quarterly", "annually"]

    if (!allowedFrequencies.includes(frequency)) {
      return res.status(400).json({
        error: "Invalid frequency",
      })
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({
        error: "At least one class is required",
      })
    }

    const classIdsSet = new Set()

    for (const item of classIds) {
      if (!item || typeof item !== "object") {
        return res.status(400).json({
          error: "Each class entry must be an object",
        })
      }

      const { classId, amount } = item

      // Validate classId
      if (!classId) {
        return res.status(400).json({
          error: "Class ID is required",
        })
      }

      if (!isValidObjectId(classId)) {
        return res.status(400).json({
          error: "Invalid class ID format",
        })
      }

      // Prevent duplicate classes
      if (classIdsSet.has(classId)) {
        return res.status(400).json({
          error: "Each class can only be added once",
        })
      }

      classIdsSet.add(classId)

      // Validate amount
      if (
        typeof amount !== "number" ||
        !Number.isInteger(amount) ||
        amount < 0
      ) {
        return res.status(400).json({
          error: "Amount must be a non-negative whole number",
        })
      }
    }

    // Validate status
    const allowedStatuses = ["active", "inactive"]

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
      })
    }

    const body = {
      name: name.trim(),
      category,
      frequency,
      classIds,
      status,
    }

    const updated = await FeeStructure.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    if (!updated) {
      return res.status(404).json({
        error: "Fee structure not found",
      })
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
