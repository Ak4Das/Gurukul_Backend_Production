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
    if (f.category === "transport" && !student.transportRequired) {
      continue
    }

    const classFee = f.classIds.find(
      (obj) => obj.classId.toString() === studentClassIdStr,
    )

    if (!classFee) {
      continue
    }

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

//! GET /fees - Paginated receipts list
router.get("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    // If no query parameters are provided, return the entire collection.
    if (Object.keys(req.query).length === 0) {
      // Sorts documents first by date in descending order — newest date first.
      // Then, only for documents having the same date, it sorts them by createdAt in descending order.
      const receipts = await FeeReceipt.find()
        .sort({ date: -1, createdAt: -1 })
        .lean()

      return res.json(receipts)
    }
    // API uses 1-based page numbers.
    const pageNumber = Math.max(Number(req.query.page), 1)

    // Validate limit parameters
    const limit = Number(req.query.limit)

    const allowedPageSizes = [10, 25, 50, 100]

    if (!allowedPageSizes.includes(limit)) {
      return res.status(400).json({
        error: "Invalid pagination parameters",
      })
    }

    const skip = (pageNumber - 1) * limit

    //* Base query
    // These filters are common to:
    // - all receipts count
    // - paid count
    // - refunded count
    // - current table query
    // - total collection calculation
    const baseQuery = {}

    // Server-side search.
    const searchTerm = String(req.query.search).trim()
    if (searchTerm) {
      // Escape regex special characters so search input is treated as literal text rather than an arbitrary regular expression.
      const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

      const searchRegex = new RegExp(escapedSearch, "i")

      baseQuery.$or = [
        { receiptNo: searchRegex },
        { studentName: searchRegex },
        { admissionNo: searchRegex },
        { className: searchRegex },
        { mode: searchRegex },
        { status: searchRegex },
      ]
    }

    const query = { ...baseQuery }

    if (req.query.status) {
      query.status = String(req.query.status)
    }

    // Server-side sorting
    const allowedSortFields = [
      "receiptNo",
      "date",
      "studentName",
      "className",
      "amountDue",
      "amountPaid",
      "balance",
      "mode",
      "status",
    ]

    const sortBy = String(req.query.sortBy || "date")

    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        error: "Invalid sort field",
      })
    }

    const sortOrder =
      String(req.query.sortOrder).toLowerCase() === "asc" ? 1 : -1

    const sort = {
      [sortBy]: sortOrder,
      createdAt: -1,
    }

    // Pagination + counts + collection
    const [
      receipts,
      total,
      allCount,
      paidCount,
      refundedCount,
      collectionResult,
    ] = await Promise.all([
      // Only fetch the current page.
      FeeReceipt.find(query).sort(sort).skip(skip).limit(limit).lean(),

      // Total records for the currently selected tab/filter.
      FeeReceipt.countDocuments(query),

      // Total receipts independent of the selected status tab.
      FeeReceipt.countDocuments(baseQuery),

      // Total paid receipts.
      FeeReceipt.countDocuments({
        ...baseQuery,
        status: "paid",
      }),

      // Total refunded receipts.
      FeeReceipt.countDocuments({
        ...baseQuery,
        status: "refunded",
      }),

      // Total collection independent of pagination.
      FeeReceipt.aggregate([
        {
          $match: {
            ...baseQuery,
            status: { $ne: "refunded" },
          },
        },
        {
          $group: {
            _id: null,
            totalCollected: {
              $sum: "$amountPaid",
            },
          },
        },
      ]),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    return res.json({
      data: receipts,

      pagination: {
        page: total === 0 ? 1 : Math.min(pageNumber, totalPages),
        limit,
        total,
        totalPages,
      },

      counts: {
        all: allCount,
        paid: paidCount,
        refunded: refundedCount,
      },

      totalCollected: collectionResult[0]?.totalCollected || 0,
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /fees/:id - Get single receipt
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid receipt ID format",
      })
    }

    const doc = await FeeReceipt.findById(req.params.id).lean()

    if (!doc) {
      return res.status(404).json({
        error: "Receipt not found",
      })
    }

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! POST /fees - Record a fee payment
// Here i use a MongoDB transaction/session so both operations succeed or both roll back.
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  let session = null

  try {
    session = await mongoose.startSession()

    const b = req.body

    const {
      student,
      klass,
      items: ITEMS,
      subTotal,
    } = await calculateStudentFee(b.studentId, res)

    const items = (ITEMS || []).map((i) => ({
      description: String(i.name || ""),
      amount: Number(i.amount) || 0,
    }))

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

    // It's cleaner to perform the read/validation work first
    // and start the transaction immediately before the operations
    // that must be atomic.
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

    // Mirror income into Daily Accounts.
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
    if (session?.inTransaction()) {
      await session.abortTransaction()
    }

    return next(err)
  } finally {
    if (session) {
      await session.endSession()
    }
  }
})

//! POST /fees/:id/refund - Process refund
router.post(
  "/:id/refund",
  allowRoles("admin", "clerk"),
  async (req, res, next) => {
    let session = null

    try {
      session = await mongoose.startSession()

      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          error: "Invalid receipt ID format",
        })
      }

      const userName = req.user?.username

      session.startTransaction()

      const updated = await FeeReceipt.findByIdAndUpdate(
        req.params.id,
        {
          status: "refunded",
          refundedBy: userName,
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      ).lean()

      if (!updated) {
        await session.abortTransaction()

        return res.status(404).json({
          error: "Receipt not found",
        })
      }

      await DailyAccount.findOneAndDelete(
        {
          receiptId: updated._id,
        },
        {
          session,
        },
      )

      await session.commitTransaction()

      return res.json(updated)
    } catch (err) {
      if (session?.inTransaction()) {
        await session.abortTransaction()
      }

      return next(err)
    } finally {
      if (session) {
        await session.endSession()
      }
    }
  },
)

export default router
