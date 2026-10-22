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

//! GET /fees/compute/:studentId - Calculate student dues
router.get("/compute/:studentId", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.studentId)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.studentId)

    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    const klass = await Class.findById(student.classId)

    if (!klass) {
      return res.status(404).json({ error: "class not found" })
    }

    const structures = await FeeStructure.find({ status: "active" }).lean()

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
      ITEMS.push({
        structureId: f._id,
        name: f.name,
        category: f.category,
        frequency: f.frequency,
        amount: f.classIds.find(
          (obj) => obj.classId.toString() === studentClassIdStr,
        ).amount,
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
        $gt: formatDate(new Date(start)),
        $lt: formatDate(new Date(end)),
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
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const b = req.body

    if (!b.studentId || !isValidObjectId(b.studentId)) {
      return res.status(400).json({ error: "Please select a valid student" })
    }

    const student = await Student.findById(b.studentId).lean()
    if (!student) {
      return res.status(400).json({ error: "Please select a valid student" })
    }

    const klass = await Class.findById(student.classId).lean()

    const items = (b.items || []).map((i) => ({
      description: String(i.description || ""),
      amount: Number(i.amount) || 0,
    }))

    const subTotal = items.reduce((s, i) => s + i.amount, 0)
    const lateFee = Number(b.lateFee) || 0
    const discount = Number(b.discount) || 0
    const amountDue = subTotal + lateFee - discount
    const amountPaid = Number(b.amountPaid) || 0
    const balance = amountDue - amountPaid
    const status = "paid"

    const seq = await nextSeq("receipt")
    const receiptNo = `RCP-${new Date().getFullYear()}-${String(seq).padStart(8, "0")}`
    const userName = req.user?.name || req.user?.username

    const doc = await FeeReceipt.create({
      receiptNo,
      studentId: student._id,
      studentName: `${student.firstName} ${student.lastName || ""}`.trim(),
      admissionNo: student.admissionNo,
      className: klass
        ? `${klass.name} ${klass.section} (${klass.academicYear})`
        : "",
      academicYear: klass?.academicYear || "",
      date: b.date || new Date().toISOString().slice(0, 10),
      items,
      subTotal,
      lateFee,
      discount,
      amountDue,
      amountPaid,
      balance,
      mode: b.mode || "cash",
      reference: b.reference || "",
      remarks: b.remarks || "",
      collectedBy: userName,
      status,
    })

    // Mirror income into Daily Accounts
    if (amountPaid > 0) {
      await DailyAccount.create({
        date: doc.date,
        type: "income",
        category: "Fees",
        description: `Fee receipt ${doc.receiptNo} — ${doc.studentName}`,
        amount: amountPaid,
        mode: doc.mode,
        recordedBy: userName,
        receiptId: doc._id,
        receiptNumber: doc.receiptNo,
      })
    }

    return res.status(201).json(doc)
  } catch (err) {
    return next(err)
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

      const userName = req.user?.name || req.user?.username

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

      await DailyAccount.findOneAndDelete({receiptId:updated._id})

      return res.json(updated)
    } catch (err) {
      return next(err)
    }
  },
)

export default router
