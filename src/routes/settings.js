// essential imports
import { Router } from "express"
// model imports
import { Settings } from "../models/Settings.js"
// middleware imports
import { authRequired, allowRoles } from "../middleware/auth.js"

const router = Router()

// Require authentication for all settings endpoints
router.use(authRequired)

//! GET /api/settings - List all configuration settings
router.get("/", async (req, res, next) => {
  try {
    const doc = await Settings.findOne({ key: "school" }).lean()
    return res.json(doc?.value || {})
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/settings - Replace setting details (Admin only)
router.put("/", allowRoles("admin"), async (req, res, next) => {
  try {
    const existing = await Settings.findOne({ key: "school" })
    const currentValue = existing?.value || {}
    const updatedValue = { ...currentValue, ...req.body }

    const doc = await Settings.findOneAndUpdate(
      { key: "school" },
      { $set: { value: updatedValue } },
      { new: true, upsert: true },
    ).lean()

    return res.json(doc.value)
  } catch (err) {
    return next(err)
  }
})

export default router
