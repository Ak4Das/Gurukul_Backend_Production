// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { SalarySlip } from "../models/SalarySlip.js"
import { User } from "../models/User.js"
import { DailyAccount } from "../models/DailyAccount.js"
import { nextSeq } from "../models/Counter.js"
// middleware imports
import { authRequired, allowRoles } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// Helper to calculate total allowances, deductions, gross and net pay
function compute(b) {
  const basic = Number(b.salary) || 0

  return {
    salary: basic,
    gross: basic,
    totalAllowances: 0,
    totalDeductions: 0,
    netPay: basic,
  }
}

//! GET /payroll - List salary slips
router.get("/", async (req, res, next) => {
  try {
    const isStaff = ["admin", "clerk", "supervisor"].includes(req.user.role)
    const query = {}

    if (!isStaff) {
      if (!isValidObjectId(req.user.id)) {
        return res.status(400).json({ error: "Invalid user ID" })
      }
      query.staffId = req.user.id
    }

    if (req.query.month) {
      query.month = String(req.query.month)
    }
    if (req.query.status) {
      query.status = String(req.query.status)
    }

    const slips = await SalarySlip.find(query).sort({ createdAt: -1 }).lean()

    return res.json(slips)
  } catch (err) {
    return next(err)
  }
})

//! POST /payroll - Generate new salary slip
router.post("/", allowRoles("admin", "clerk"), async (req, res, next) => {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    const b = req.body

    if (!b.staffId || !b.month) {
      await session.abortTransaction()

      return res
        .status(400)
        .json({ error: "Staff member and month are required" })
    }

    if (!isValidObjectId(b.staffId)) {
      await session.abortTransaction()

      return res.status(400).json({ error: "Invalid staff ID" })
    }

    const staff = await User.findById(b.staffId).session(session).lean()

    if (!staff) {
      await session.abortTransaction()

      return res.status(400).json({ error: "Staff member not found" })
    }

    const duplicateSalarySlip = await SalarySlip.findOne({
      staffId: b.staffId,
      month: b.month,
    })
      .session(session)
      .lean()

    if (duplicateSalarySlip) {
      await session.abortTransaction()

      return res.status(400).json({
        error: `A slip for ${staff.fullName || staff.name} (${b.month}) already exists`,
      })
    }

    // Counter increment is part of the same transaction
    const seq = await nextSeq("salarySlip", session)

    const computedValues = compute(b)

    const doc = await SalarySlip.create(
      [
        {
          slipNo: `SLP-${b.month.replace("-", "")}-${String(seq).padStart(4, "0")}`,
          staffId: staff._id,
          staffName: staff.fullName || staff.name,
          role: staff.role,
          designation: staff.specialization || staff.role,
          month: b.month,
          ...computedValues,
          workingDays: Number(b.workingDays) || 26,
          presentDays: Number(b.presentDays) ?? (Number(b.workingDays) || 26),
          mode: b.mode || "cash",
          status: "generated",
          generatedBy:
            req.user.fullName || req.user.name || req.user.username || "Admin",
        },
      ],
      { session },
    )

    await session.commitTransaction()

    return res.status(201).json(doc[0])
  } catch (err) {
    await session.abortTransaction()

    return next(err)
  } finally {
    await session.endSession()
  }
})

//! PUT /payroll/:id - Update salary slip
router.put("/:id", allowRoles("admin", "clerk"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid slip ID" })
    }

    const existing = await SalarySlip.findById(req.params.id).lean()
    if (!existing) {
      return res.status(404).json({ error: "Slip not found" })
    }
    if (existing.status === "paid") {
      return res.status(400).json({
        error: "Paid slips cannot be edited",
      })
    }

    const b = { ...req.body }
    delete b._id

    const computedValues = compute({
      ...existing,
      ...b,
    })

    const updateData = {
      ...b,
      ...computedValues,
    }

    const updated = await SalarySlip.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      },
    ).lean()

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! POST /payroll/:id/pay - Mark paid and record daily expense
router.post(
  "/:id/pay",
  allowRoles("admin", "clerk"),
  async (req, res, next) => {
    const session = await mongoose.startSession()

    try {
      session.startTransaction()

      if (!isValidObjectId(req.params.id)) {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Invalid slip ID",
        })
      }

      const slip = await SalarySlip.findById(req.params.id).session(session)

      if (!slip) {
        await session.abortTransaction()

        return res.status(404).json({
          error: "Slip not found",
        })
      }

      if (slip.status === "paid") {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Already paid",
        })
      }

      const today = new Date().toISOString().slice(0, 10)
      const paidBy =
        req.user.fullName || req.user.name || req.user.username || "Admin"
      const paymentMode = req.body.mode || "online"

      slip.status = "paid"
      slip.paidOn = today
      slip.mode = paymentMode
      slip.paidBy = paidBy

      await slip.save({ session })

      await DailyAccount.create(
        [
          {
            date: slip.paidOn || today,
            type: "expense",
            category: "Salary",
            description: `Salary ${slip.month} — ${slip.staffName} (${slip.slipNo})`,
            amount: slip.netPay,
            mode: slip.mode || "cash",
            recordedBy: paidBy || slip.paidBy || slip.generatedBy || "Admin",
            slipNumber: slip.slipNo,
            slipId: slip._id,
          },
        ],
        { session },
      )

      await session.commitTransaction()

      return res.json(slip)
    } catch (err) {
      await session.abortTransaction()

      return next(err)
    } finally {
      await session.endSession()
    }
  },
)

//! DELETE /payroll/:id - Remove salary slip
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    if (!isValidObjectId(req.params.id)) {
      await session.abortTransaction()

      return res.status(400).json({
        error: "Invalid slip ID",
      })
    }

    const deleted = await SalarySlip.findByIdAndDelete(req.params.id, {
      session,
    })

    if (!deleted) {
      await session.abortTransaction()

      return res.status(404).json({
        error: "Slip not found",
      })
    }

    await DailyAccount.deleteMany(
      {
        slipId: deleted._id,
      },
      { session },
    )

    await session.commitTransaction()

    return res.json({ ok: true })
  } catch (err) {
    await session.abortTransaction()

    return next(err)
  } finally {
    await session.endSession()
  }
})

export default router
