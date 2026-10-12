import { Router } from "express"
import mongoose from "mongoose"
import { InventoryItem } from "../models/InventoryItem.js"
import { StockMovement } from "../models/StockMovement.js"
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// ==========================================
// GET /inventory - List items (Filter low stock)
// ==========================================
router.get("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const filter = {}

    // DB-level low stock comparison via $expr
    if (req.query.low === "true") {
      filter.$expr = {
        $lte: [
          { $ifNull: ["$quantity", 0] },
          { $ifNull: ["$reorderLevel", 0] },
        ],
      }
    }

    const items = await InventoryItem.find(filter).sort({ name: 1 }).lean()

    return res.json(items)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// POST /inventory - Create new inventory item
// ==========================================
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = req.body
    if (!b.name) {
      return res.status(400).json({ error: "Item name is required" })
    }

    const doc = await InventoryItem.create({
      ...b,
      quantity: Number(b.openingStock) || Number(b.quantity) || 0,
      unit: b.unit || "pieces",
      reorderLevel: Number(b.reorderLevel) || 0,
      status: "active",
    })

    return res.status(201).json(doc)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// PUT /inventory/:id - Update item details
// ==========================================
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item ID" })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await InventoryItem.findByIdAndUpdate(req.params.id, b, {
      new: true,
      runValidators: true,
    }).lean()

    if (!updated) {
      return res.status(404).json({ error: "Item not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// POST /inventory/:id/move - Stock movement (in | issue | adjust)
// ==========================================
router.post("/:id/move", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item ID" })
    }

    const item = await InventoryItem.findById(req.params.id)
    if (!item) {
      return res.status(404).json({ error: "Item not found" })
    }

    const { type, quantity, note, issuedTo } = req.body
    const qty = Number(quantity)

    if (!["in", "issue", "adjust"].includes(type) || Number.isNaN(qty)) {
      return res
        .status(400)
        .json({ error: "Valid movement type and quantity are required" })
    }

    let newQty = item.quantity || 0
    if (type === "in") {
      newQty += Math.abs(qty)
    } else if (type === "issue") {
      if (Math.abs(qty) > newQty) {
        return res
          .status(400)
          .json({ error: `Only ${newQty} ${item.unit} in stock` })
      }
      newQty -= Math.abs(qty)
    } else {
      // adjust = set absolute quantity
      newQty = qty
    }

    const today = new Date().toISOString().slice(0, 10)
    const performedBy =
      req.user.fullName || req.user.name || req.user.username || "Staff"

    await StockMovement.create({
      itemId: item._id,
      itemName: item.name,
      type,
      quantity: qty,
      balanceAfter: newQty,
      note: note || "",
      issuedTo: issuedTo || "",
      date: today,
      by: performedBy,
    })

    item.quantity = newQty
    await item.save()

    return res.json(item)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// GET /inventory/:id/movements - Fetch audit log of stock movements
// ==========================================
router.get("/:id/movements", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item ID" })
    }

    const movements = await StockMovement.find({ itemId: req.params.id })
      .sort({ createdAt: -1 })
      .lean()

    return res.json(movements)
  } catch (err) {
    return next(err)
  }
})

// ==========================================
// DELETE /inventory/:id - Delete item (Admin only)
// ==========================================
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid item ID" })
    }

    const deleted = await InventoryItem.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: "Item not found" })
    }

    // Optionally cleanup associated stock movements
    await StockMovement.deleteMany({ itemId: req.params.id })

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
