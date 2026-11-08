// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { DailyAccount } from "../models/DailyAccount.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()

// Require authentication for all daily account endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/daily-accounts - List all daily account entries
router.get("/", async (req, res, next) => {
  try {
    const dailyAccounts = await DailyAccount.find().sort({ date: -1 }).lean()

    return res.json(dailyAccounts)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/daily-accounts/:id - Get a daily account record by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid daily account ID format" })
    }

    const item = await DailyAccount.findById(req.params.id).lean()

    if (!item) {
      return res.status(404).json({ error: "Daily account record not found" })
    }

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/daily-accounts - Create a new daily account record
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { date, type, category, description, amount, mode } = req.body

    // Date validation
    if (!date) {
      return res.status(400).json({
        error: "Date is required",
      })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Validate that the date is a real calendar date
    const [year, month, day] = date.split("-").map(Number)
    const parsedDate = new Date(year, month - 1, day)

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return res.status(400).json({ error: "Invalid calendar date" })
    }

    // Validate that date is not in the past
    const today = new Date().toISOString().slice(0, 10)

    if (date < today) {
      return res.status(400).json({
        error: "PTM date cannot be in the past",
      })
    }

    // Type validation
    if (!type) {
      return res.status(400).json({
        error: "Type is required",
      })
    }

    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({
        error: "Invalid account type",
      })
    }

    // Category validation
    if (!category) {
      return res.status(400).json({
        error: "Category is required",
      })
    }

    const allowedCategories = ["Donation", "Utilities", "Maintenance"]

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid category",
      })
    }

    // Category/type validation
    if (category === "Donation" && type !== "income") {
      return res.status(400).json({
        error: "Donation category is only valid for income",
      })
    }

    if (["Utilities", "Maintenance"].includes(category) && type !== "expense") {
      return res.status(400).json({
        error: `${category} category is only valid for expense`,
      })
    }

    // Amount validation
    if (!amount) {
      return res.status(400).json({
        error: "Amount is required",
      })
    }

    const numericAmount = Number(amount)

    if (numericAmount < 0) {
      return res.status(400).json({
        error: "Amount cannot be negative",
      })
    }

    // Payment mode validation
    if (!mode) {
      return res.status(400).json({
        error: "Payment mode is required",
      })
    }

    if (!["cash", "online", "check", "upi", "card"].includes(mode)) {
      return res.status(400).json({
        error: "Invalid payment mode",
      })
    }

    // Create only server-controlled fields
    const dailyAccount = await DailyAccount.create({
      date,
      type,
      category,
      description: description ?? "",
      amount: numericAmount,
      mode,
      recordedBy: req.user.username,
    })

    return res.status(201).json(dailyAccount)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/daily-accounts/:id - Replace daily account details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid daily account ID format",
      })
    }

    // Find the existing record
    const existing = await DailyAccount.findById(req.params.id).lean()

    if (!existing) {
      return res.status(404).json({
        error: "Daily account record not found",
      })
    }

    if (["Fees", "Salary"].includes(existing.category)) {
      return res.status(400).json({
        error: `${existing.category} records cannot be manually edited`,
      })
    }

    const { date, type, category, description, amount, mode } = req.body

    // Date validation
    if (!date) {
      return res.status(400).json({
        error: "Date is required",
      })
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Date must be in YYYY-MM-DD format",
      })
    }

    // Validate that the date is a real calendar date
    const [year, month, day] = date.split("-").map(Number)
    const parsedDate = new Date(year, month - 1, day)

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      return res.status(400).json({ error: "Invalid calendar date" })
    }

    // Validate that date is not in the past
    const today = new Date().toISOString().slice(0, 10)

    if (date < today) {
      return res.status(400).json({
        error: "PTM date cannot be in the past",
      })
    }

    // Type validation
    if (!type) {
      return res.status(400).json({
        error: "Type is required",
      })
    }

    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({
        error: "Invalid account type",
      })
    }

    // Category validation
    if (!category) {
      return res.status(400).json({
        error: "Category is required",
      })
    }

    const allowedCategories = ["Donation", "Utilities", "Maintenance"]

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        error: "Invalid category",
      })
    }

    // Category/type validation
    if (category === "Donation" && type !== "income") {
      return res.status(400).json({
        error: "Donation category is only valid for income",
      })
    }

    if (["Utilities", "Maintenance"].includes(category) && type !== "expense") {
      return res.status(400).json({
        error: `${category} category is only valid for expense`,
      })
    }

    // Amount validation
    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        error: "Amount is required",
      })
    }

    const numericAmount = Number(amount)

    if (numericAmount < 0) {
      return res.status(400).json({
        error: "Amount cannot be negative",
      })
    }

    // Payment mode validation
    if (!mode) {
      return res.status(400).json({
        error: "Payment mode is required",
      })
    }

    if (!["cash", "online", "check", "upi", "card"].includes(mode)) {
      return res.status(400).json({
        error: "Invalid payment mode",
      })
    }

    // Only allow fields that can be manually edited.
    const body = {
      date,
      type,
      category,
      description: description ?? "",
      amount: numericAmount,
      mode,
      recordedBy: req.user.username,
    }

    const updated = await DailyAccount.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      {
        returnDocument: "after",
        runValidators: true,
      },
    ).lean()

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/daily-accounts/:id - Delete daily account record
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid daily account ID format" })
    }

    const deleted = await DailyAccount.findByIdAndDelete(req.params.id).lean()

    if (!deleted) {
      return res.status(404).json({ error: "Daily account record not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
