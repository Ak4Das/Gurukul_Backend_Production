// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { DailyAccount } from "../models/DailyAccount.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { InventoryItem } from "../models/InventoryItem.js"
import { SalarySlip } from "../models/SalarySlip.js"
import { User } from "../models/User.js"
import { Asset } from "../models/Asset.js"

const router = Router()

// Require authentication for all daily account endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/daily-accounts - List all daily account entries
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
    let execQuery = DailyAccount.find(query).sort({ date: -1 })

    if (req.query.skip) {
      execQuery = execQuery.skip(Number(req.query.skip))
    }
    if (req.query.limit) {
      execQuery = execQuery.limit(Number(req.query.limit))
    }

    const dailyAccounts = await execQuery.lean()

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
  const body = { ...req.body }

  if (!body.recordedBy) {
    return res.status(404).json({ error: "recordedBy field is required" })
  }

  const recordedByUser = await User.findOne({
    username: body.recordedBy,
  })

  if (!recordedByUser) {
    return res.status(404).json({ error: "recordedBy user not found" })
  }

  if (body.category !== "Fees") {
    delete body.receiptNumber
  } else {
    if (!body.receiptNumber) {
      return res.status(404).json({ error: "Fee Receipt number is required" })
    }

    const receipt = await FeeReceipt.findOne({
      receiptNo: body.receiptNumber,
    }).lean()

    if (!receipt) {
      return res.status(404).json({ error: "Fee Receipt not found" })
    }

    body.receiptId = receipt._id
    if (!body.description) {
      body.description = `Fee receipt ${receipt.receiptNo} — ${receipt.studentName}`
    }
  }

  if (body.category !== "Supplies") {
    delete body.itemName
  } else {
    if (!body.itemName) {
      return res.status(404).json({ error: "Item name is required" })
    }

    const item = await InventoryItem.findOne({ name: body.itemName }).lean()

    if (!item) {
      return res.status(404).json({ error: "Item not found" })
    }

    body.itemId = item._id
    if (!body.description) {
      body.description = `Item ${item.name} — ${item.category}`
    }
  }

  if (body.category !== "Salary") {
    delete body.slipNumber
  } else {
    if (!body.slipNumber) {
      return res.status(404).json({ error: "Slip number is required" })
    }

    const slip = await SalarySlip.findOne({ slipNo: body.slipNumber }).lean()

    if (!slip) {
      return res.status(404).json({ error: "Slip not found" })
    }

    body.slipId = slip._id
    if (!body.description) {
      body.description = `Salary ${slip.month} — ${slip.staffName} (${slip.slipNo})`
    }
  }

  if (body.category !== "Maintenance") {
    delete body.assetName
  } else {
    if (!body.assetName) {
      return res.status(404).json({ error: "Asset name is required" })
    }

    const asset = await Asset.findOne({
      name: body.assetName,
    }).lean()

    if (!asset) {
      return res.status(404).json({ error: "Asset not found" })
    }

    body.assetId = asset._id
    if (!body.description) {
      body.description = `${asset.name} (${asset.tag}): ${asset.category}`
    }
  }

  try {
    const dailyAccount = await DailyAccount.create(body)
    return res.status(201).json(dailyAccount)
  } catch (err) {
    return next(err)
  }
})

//! PUT /api/daily-accounts/:id - Replace daily account details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid daily account ID format" })
    }

    let body = { ...req.body }
    delete body._id

    if (!body.recordedBy) {
      return res.status(404).json({ error: "recordedBy field is required" })
    }

    const recordedByUser = await User.findOne({
      username: body.recordedBy,
    })

    if (!recordedByUser) {
      return res.status(404).json({ error: "recordedBy user not found" })
    }

    if (body.category !== "Fees") {
      delete body.receiptNumber
      delete body.receiptId
    } else {
      if (!body.receiptNumber) {
        return res.status(404).json({ error: "Fee Receipt number is required" })
      }

      const receipt = await FeeReceipt.findOne({
        receiptNo: body.receiptNumber,
      }).lean()

      if (!receipt) {
        return res.status(404).json({ error: "Fee Receipt not found" })
      }

      body.receiptId = receipt._id
      if (!body.description) {
        body.description = `Fee receipt ${receipt.receiptNo} — ${receipt.studentName}`
      }
    }

    if (body.category !== "Supplies") {
      delete body.itemName
      delete body.itemId
    } else {
      if (!body.itemName) {
        return res.status(404).json({ error: "Item name is required" })
      }

      const item = await InventoryItem.findOne({ name: body.itemName }).lean()

      if (!item) {
        return res.status(404).json({ error: "Item not found" })
      }

      body.itemId = item._id
      if (!body.description) {
        body.description = `Item ${item.name} — ${item.category}`
      }
    }

    if (body.category !== "Salary") {
      delete body.slipNumber
      delete body.slipId
    } else {
      if (!body.slipNumber) {
        return res.status(404).json({ error: "Slip number is required" })
      }

      const slip = await SalarySlip.findOne({ slipNo: body.slipNumber }).lean()

      if (!slip) {
        return res.status(404).json({ error: "Slip not found" })
      }

      body.slipId = slip._id
      if (!body.description) {
        body.description = `Salary ${slip.month} — ${slip.staffName} (${slip.slipNo})`
      }
    }

    if (body.category !== "Maintenance") {
      delete body.assetName
      delete body.assetId
    } else {
      if (!body.assetName) {
        return res.status(404).json({ error: "Asset name is required" })
      }

      const asset = await Asset.findOne({
        name: body.assetName,
      }).lean()

      if (!asset) {
        return res.status(404).json({ error: "Asset not found" })
      }

      body.assetId = asset._id
      if (!body.description) {
        body.description = `${asset.name} (${asset.tag}): ${asset.category}`
      }
    }

    const unset = {}

    if (body.category === "Fees") {
      unset.itemName = ""
      unset.itemId = ""
      unset.assetName = ""
      unset.assetId = ""
      unset.slipNumber = ""
      unset.slipId = ""
    } else if (body.category === "Supplies") {
      unset.receiptNumber = ""
      unset.receiptId = ""
      unset.assetName = ""
      unset.assetId = ""
      unset.slipNumber = ""
      unset.slipId = ""
    } else if (body.category === "Salary") {
      unset.receiptNumber = ""
      unset.receiptId = ""
      unset.itemName = ""
      unset.itemId = ""
      unset.assetName = ""
      unset.assetId = ""
    } else if (body.category === "Maintenance") {
      unset.receiptNumber = ""
      unset.receiptId = ""
      unset.itemName = ""
      unset.itemId = ""
      unset.slipNumber = ""
      unset.slipId = ""
    } else {
      unset.receiptNumber = ""
      unset.receiptId = ""
      unset.itemName = ""
      unset.itemId = ""
      unset.assetName = ""
      unset.assetId = ""
      unset.slipNumber = ""
      unset.slipId = ""
    }

    const updated = await DailyAccount.findByIdAndUpdate(
      req.params.id,
      { $set: body, $unset: unset },
      { new: true, runValidators: true },
    ).lean()

    if (!updated) {
      return res.status(404).json({ error: "Daily account record not found" })
    }
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
