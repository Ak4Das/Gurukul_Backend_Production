// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Asset } from "../models/Asset.js"
import { DailyAccount } from "../models/DailyAccount.js"
import { nextSeq } from "../models/Counter.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /assets - List assets with filters
router.get("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const query = {}
    if (req.query.status) {
      query.status = String(req.query.status)
    }
    if (req.query.category) {
      query.category = String(req.query.category)
    }

    const assets = await Asset.find(query).sort({ createdAt: -1 }).lean()
    return res.json(assets)
  } catch (err) {
    return next(err)
  }
})

//! POST /assets - Create new asset record
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = req.body
    if (!b.name) {
      return res.status(400).json({ error: "Asset name is required" })
    }

    const seq = await nextSeq("assetTag")
    const tag = `AST-${String(seq).padStart(5, "0")}`

    const doc = await Asset.create({
      tag,
      status: "in-use",
      maintenance: [],
      ...b,
    })

    return res.status(201).json(doc)
  } catch (err) {
    return next(err)
  }
})

//! PUT /assets/:id - Update asset details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid asset ID format" })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await Asset.findByIdAndUpdate(req.params.id, b, {
      new: true,
      runValidators: true,
    }).lean()

    if (!updated) {
      return res.status(404).json({ error: "Asset not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! POST /assets/:id/maintenance - Log maintenance with expense
router.post(
  "/:id/maintenance",
  allowRoles(...STAFF),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid asset ID format" })
      }

      const entry = {
        date: req.body.date || new Date().toISOString().slice(0, 10),
        description: req.body.description || "",
        cost: Number(req.body.cost) || 0,
        by:
          req.user?.fullName || req.user?.name || req.user?.username || "Staff",
      }

      // Use $push operator to append to array field
      const updatedAsset = await Asset.findByIdAndUpdate(
        req.params.id,
        { $push: { maintenance: entry } },
        { new: true, runValidators: true },
      ).lean()

      if (!updatedAsset) {
        return res.status(404).json({ error: "Asset not found" })
      }

      // Automatically create expense log if cost is incurred
      if (entry.cost > 0) {
        await DailyAccount.create({
          date: entry.date,
          type: "expense",
          category: "Maintenance",
          description: `${updatedAsset.name} (${updatedAsset.tag}): ${updatedAsset.category}`,
          amount: entry.cost,
          mode: "cash",
          recordedBy: entry.by,
          assetId: updatedAsset._id,
          assetName: updatedAsset.name,
        })
      }

      return res.json(updatedAsset)
    } catch (err) {
      return next(err)
    }
  },
)

//! DELETE /assets/:id - Remove asset (Admin only)
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid asset ID format" })
    }

    const deleted = await Asset.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: "Asset not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
