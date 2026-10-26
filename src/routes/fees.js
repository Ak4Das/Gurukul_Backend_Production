import { Router } from "express"
import mongoose from "mongoose"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { FeeStructure } from "../models/FeeStructure.js"
import { DailyAccount } from "../models/DailyAccount.js"
import { Student } from "../models/Student.js"
import { Class } from "../models/Class.js"
import { nextSeq } from "../models/Counter.js"

import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

async function calculateStudentFee(studentId, res) {
  if (!isValidObjectId(studentId)) {
    return res.status(400).json({ error: "Invalid student ID format" })
  }

  const student = await Student.findById(studentId).lean()

  if (!student) {
    return res.status(400).json({ error: "Student not found" })
  }

  const klass = await Class.findById(student.classId).lean()

  if (!klass) {
    return res.status(400).json({ error: "Student class not found" })
  }

  const structures = await FeeStructure.find({
    status: "active",
  }).lean()

  const studentClassIdStr = student.classId ? student.classId.toString() : ""

  const applicable = structures.filter((f) => {
    if (!f.classIds || f.classIds.length === 0) {
      return true
    }
    return f.classIds.some(
      (obj) => obj.classId.toString() === studentClassIdStr,
    )
  })

  const ITEMS = []
  for (const f of applicable) {
    if (f.category === "transport" && !student.transportRequired) continue

    const classFee = f.classIds.find(
      (obj) => obj.classId.toString() === studentClassIdStr,
    )

    if (!classFee) continue

    ITEMS.push({
      structureId: f._id,
      name: f.name,
      category: f.category,
      frequency: f.frequency,
      amount: classFee.amount,
    })
  }

  const currentMonth = new Date().toLocaleString("en-US", {
    month: "long",
  })

  const items = ITEMS.filter((i) => {
    if (i.frequency === "annually" && currentMonth !== "March") {
      return false
    }
    return true
  })

  const subTotal = items.reduce((sum, item) => sum + item.amount, 0)

  return {
    student,
    klass,
    items,
    subTotal,
  }
}

//! GET /fees/compute/:studentId - Calculate student dues
router.get("/compute/:studentId", async (req, res, next) => {
  try {
    const { student, klass, items } = await calculateStudentFee(
      req.params.studentId,
      res,
    )

    const today = new Date()

    const firstDate = new Date(today.getFullYear(), today.getMonth(), 1)

    const lastDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")

      return `${year}-${month}-${day}`
    }

    const start = formatDate(firstDate)
    const end = formatDate(lastDate)

    const paid = await FeeReceipt.find({
      studentId: student._id,
      status: { $ne: "refunded" },
      date: {
        $gte: formatDate(new Date(start)),
        $lte: formatDate(new Date(end)),
      },
    }).lean()

    return res.json({
      student: {
        _id: student._id,
        name: `${student.firstName} ${student.lastName || ""}`.trim(),
        admissionNo: student.admissionNo,
      },
      className: klass
        ? `${klass.name} ${klass.section} (${klass.academicYear})`
        : "",
      items,
      status: paid.length ? "paid" : "unpaid",
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /fees - Receipts list
router.get("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const query = {}
    if (req.query.status) {
      query.status = String(req.query.status)
    }
    if (req.query.studentId && isValidObjectId(req.query.studentId)) {
      query.studentId = req.query.studentId
    }

    const receipts = await FeeReceipt.find(query).sort({ createdAt: -1 })
    return res.json(receipts)
  } catch (err) {
    return next(err)
  }
})

//! GET /fees/:id - Get single receipt
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid receipt ID format" })
    }

    const doc = await FeeReceipt.findById(req.params.id).lean()
    if (!doc) {
      return res.status(404).json({ error: "Receipt not found" })
    }

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! POST /fees - Record a fee payment
// Here i use a MongoDB transaction/session so both operations succeed or both roll back.
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  const session = await mongoose.startSession()
  try {
    const b = req.body

    const {
      student,
      klass,
      items:ITEMS,
      subTotal,
    } = await calculateStudentFee(b.studentId, res)

    const items = (ITEMS || []).map((i) => ({
      description: String(i.name || ""),
      amount: Number(i.amount) || 0,
    }))

    if (items.some((item) => item.amount < 0)) {
      return res.status(400).json({
        error: "Fee amount cannot be negative",
      })
    }

    const today = new Date()

    const firstDate = new Date(today.getFullYear(), today.getMonth(), 1)

    const lastDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")

      return `${year}-${month}-${day}`
    }

    const start = formatDate(firstDate)
    const end = formatDate(lastDate)

    const paid = await FeeReceipt.find({
      studentId: student._id,
      status: { $ne: "refunded" },
      date: {
        $gte: formatDate(new Date(start)),
        $lte: formatDate(new Date(end)),
      },
    }).lean()

    if (paid.length > 0) {
      return res.status(400).json({
        error:
          "Fee payment has already been recorded for this student for the current month",
      })
    }

    const lateFee = Number(b.lateFee) || 0
    const discount = Number(b.discount) || 0
    const amountDue = subTotal + lateFee - discount
    const amountPaid = amountDue
    const balance = 0
    const status = "paid"

    if (lateFee < 0) {
      return res.status(400).json({
        error: "Late fee cannot be negative",
      })
    }

    if (discount < 0) {
      return res.status(400).json({
        error: "Discount cannot be negative",
      })
    }

    if (discount > subTotal + lateFee) {
      return res.status(400).json({
        error: "Discount cannot exceed the amount due",
      })
    }

    // It's cleaner to perform the read/validation work first and start the transaction immediately before the operations that must be atomic
    session.startTransaction()

    const seq = await nextSeq("receipt", session)
    const receiptNo = `RCP-${new Date().getFullYear()}-${String(seq).padStart(8, "0")}`
    const userName = req.user?.name || req.user?.username

    const [doc] = await FeeReceipt.create(
      [
        {
          receiptNo,
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
          admissionNo: student.admissionNo,
          className: klass
            ? `${klass.name} ${klass.section} (${klass.academicYear})`
            : "",
          academicYear: klass?.academicYear || "",
          date: new Date().toISOString().slice(0, 10),
          items,
          subTotal,
          lateFee,
          discount,
          amountDue,
          amountPaid,
          balance,
          mode: b.mode || "cash",
          remarks: b.remarks || "",
          collectedBy: userName,
          status,
        },
      ],
      { session },
    )

    // Mirror income into Daily Accounts
    if (amountPaid > 0) {
      await DailyAccount.create(
        [
          {
            date: doc.date,
            type: "income",
            category: "Fees",
            description: `Fee receipt ${doc.receiptNo} — ${doc.studentName}`,
            amount: amountPaid,
            mode: doc.mode,
            recordedBy: userName,
            receiptId: doc._id,
            receiptNumber: doc.receiptNo,
          },
        ],
        { session },
      )
    }

    await session.commitTransaction()

    return res.status(201).json(doc)
  } catch (err) {
    await session.abortTransaction()
    return next(err)
  } finally {
    await session.endSession()
  }
})

//! PUT /fees/:id - Update receipt details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid receipt ID format" })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await FeeReceipt.findByIdAndUpdate(req.params.id, b, {
      new: true,
      runValidators: true,
    }).lean()

    if (!updated) {
      return res.status(404).json({ error: "Receipt not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! POST /fees/:id/refund - Process refund
router.post(
  "/:id/refund",
  allowRoles("admin", "clerk"),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid receipt ID format" })
      }

      const userName = req.user?.username

      const updated = await FeeReceipt.findByIdAndUpdate(
        req.params.id,
        {
          status: "refunded",
          refundedBy: userName,
        },
        { new: true, runValidators: true },
      ).lean()

      if (!updated) {
        return res.status(404).json({ error: "Receipt not found" })
      }

      await DailyAccount.findOneAndDelete({ receiptId: updated._id })

      return res.json(updated)
    } catch (err) {
      return next(err)
    }
  },
)

export default router
