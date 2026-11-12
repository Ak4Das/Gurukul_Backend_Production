// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { SalarySlip } from "../models/SalarySlip.js"
import { User } from "../models/User.js"
import { DailyAccount } from "../models/DailyAccount.js"
import { nextSeq } from "../models/Counter.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { payrollCreateSchema } from "../schema/payrollCreate.schema.js"
import { payrollUpdateSchema } from "../schema/payrollUpdate.schema.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /payroll - List salary slips
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
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

//! POST /payroll - Create new salary slip
router.post(
  "/",
  allowRoles("admin", "clerk"),
  SchemaValidation(payrollCreateSchema),
  async (req, res, next) => {
    let session

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      const b = req.body

      // Find staff member
      const staff = await User.findById(b.staffId).session(session).lean()

      if (!staff) {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Staff member not found",
        })
      }

      // Prevent duplicate salary slip for same staff/month
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

      // Generate next salary slip sequence
      const seq = await nextSeq("salarySlip", session)

      // Apply defaults for optional fields
      const workingDays = b.workingDays ?? 26
      const presentDays = b.presentDays ?? workingDays
      const salary = b.salary

      // Create salary slip
      const doc = await SalarySlip.create(
        [
          {
            slipNo: `SLP-${b.month.replace("-", "")}-${String(seq).padStart(
              4,
              "0",
            )}`,
            staffId: staff._id,
            staffName: staff.fullName || staff.name,
            role: staff.role,
            designation: staff.specialization || staff.role,
            month: b.month,
            salary,
            gross: salary,
            netPay: salary,
            workingDays,
            presentDays,
            mode: b.mode ?? "cash",
            status: "generated",
            generatedBy:
              req.user.username ||
              req.user.fullName ||
              req.user.name ||
              "Admin",
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
  },
)

//! PUT /payroll/:id - Update salary slip
router.put(
  "/:id",
  allowRoles("admin", "clerk"),
  SchemaValidation(payrollUpdateSchema),
  async (req, res, next) => {
    let session

    try {
      session = await mongoose.startSession()
      session.startTransaction()

      // Validate slip ID
      if (!isValidObjectId(req.params.id)) {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Invalid slip ID",
        })
      }

      // Find existing salary slip
      const existing = await SalarySlip.findById(req.params.id)
        .session(session)
        .lean()

      if (!existing) {
        await session.abortTransaction()

        return res.status(404).json({
          error: "Slip not found",
        })
      }

      // Paid slips cannot be edited
      if (existing.status === "paid") {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Paid slips cannot be edited",
        })
      }

      const b = req.body

      // Check for duplicate only when the month changes
      const finalMonth = b.month ?? existing.month

      if (finalMonth !== existing.month) {
        const duplicateSalarySlip = await SalarySlip.findOne({
          staffId: existing.staffId,
          month: finalMonth,
          _id: { $ne: existing._id },
        })
          .session(session)
          .lean()

        if (duplicateSalarySlip) {
          await session.abortTransaction()

          return res.status(400).json({
            error: `A salary slip for ${existing.staffName} (${finalMonth}) already exists`,
          })
        }
      }

      // Determine final attendance values
      const finalWorkingDays = b.workingDays ?? existing.workingDays
      const finalPresentDays = b.presentDays ?? existing.presentDays

      // Validate the combined values against existing data
      if (finalPresentDays > finalWorkingDays) {
        await session.abortTransaction()

        return res.status(400).json({
          error: "Present days cannot exceed working days",
        })
      }

      // Recalculate salary-related values
      const salary = b.salary ?? existing.salary

      const updateData = {
        ...b,
        month: finalMonth,
        salary,
        gross: salary,
        netPay: salary,
        workingDays: finalWorkingDays,
        presentDays: finalPresentDays,
        mode: b.mode ?? existing.mode,
      }

      const updated = await SalarySlip.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true,
          session,
        },
      ).lean()

      await session.commitTransaction()

      return res.json(updated)
    } catch (err) {
      await session.abortTransaction()

      return next(err)
    } finally {
      await session.endSession()
    }
  },
)

//! POST /payroll/:id/pay - Mark paid and record daily expense
router.post(
  "/:id/pay",
  allowRoles("admin", "clerk"),
  async (req, res, next) => {
    let session
    try {
      session = await mongoose.startSession()

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
      const paidBy = req.user.username || req.user.fullName || req.user.name
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
            recordedBy: paidBy || slip.paidBy || slip.generatedBy,
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
  let session
  try {
    session = await mongoose.startSession()

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

    await DailyAccount.deleteOne(
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
