// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Student } from "../models/Student.js"
import { Parent } from "../models/Parent.js"
import { User } from "../models/User.js"
import { nextSeq } from "../models/Counter.js"
import { FeeReceipt } from "../models/FeeReceipt.js"
import { FeeStructure } from "../models/FeeStructure.js"
import { Attendance } from "../models/Attendance.js"
import { Mark } from "../models/Mark.js"
import { Exam } from "../models/Exam.js"
import { Subject } from "../models/Subject.js"

import {
  authRequired,
  allowRoles,
  STAFF,
  STAFF_TEACHER,
} from "../middleware/auth.js"
import { Class } from "../models/Class.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /students - List, search, filter, sort and paginate students
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    if (req.query.paginated !== "true") {
      const query = { ...req.query }
      delete query.paginated

      const docs = await Student.find(query).sort({ admissionNo: 1 })

      return res.json(docs)
    }

    const {
      page: pageParam = "1",
      limit: limitParam = "10",
      search = "",
      status = "",
      classId = "",
      gender = "",
      hasAllergies = "false",
      sortBy = "admissionNo",
      sortOrder = "asc",
    } = req.query

    // Pagination
    const requestedPage = Math.max(1, Number.parseInt(pageParam, 10) || 1)
    const allowedPageSizes = [10, 25, 50, 100]
    let limit = Number.parseInt(limitParam, 10) || 10

    if (!allowedPageSizes.includes(limit)) {
      limit = 10
    }

    // Validate filters
    const allowedStatuses = [
      "active",
      "inactive",
      "transferred",
      "passed-out",
      "suspended",
    ]
    const allowedGenders = ["Male", "Female", "Other"]

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid student status",
      })
    }

    if (gender && !allowedGenders.includes(gender)) {
      return res.status(400).json({
        error: "Invalid student gender",
      })
    }

    if (classId && !isValidObjectId(classId)) {
      return res.status(400).json({
        error: "Invalid class ID format",
      })
    }

    // Base filters
    const match = {}

    if (classId) {
      match.classId = new mongoose.Types.ObjectId(classId)
    }

    if (gender) {
      match.gender = gender
    }

    // "\\S" => string containing at least one non-whitespace character.
    if (hasAllergies === "true") {
      match.allergies = {
        $regex: "\\S",
      }
    }

    // If you added baseMatch.status = status then the entire aggregation would be restricted to the selected status.
    // Consequently, the statusCounts calculation would only see active students when the active tab was selected.
    // We need status counts for all statuses even when the currently selected StatusTab is only "active"
    const baseMatch = { ...match }

    // Escape user search text before creating regex
    // escapeRegex() function escapes regular-expression metacharacters so that user-entered text is interpreted literally.
    // it lets us safely turn arbitrary user input into a case‑insensitive regex pattern without breaking on special characters.
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const searchText = String(search).trim()

    // The i flag makes the regular expression case-insensitive.
    // The RegExp constructor takes a string and builds a regex from it, which is exactly what you need when the search term is user-provided.
    // Using RegExp constructor on user input is cleaner and more expressive than manually lowercasing everything, and it’s easy to extend later.
    const searchRegex = searchText
      ? new RegExp(escapeRegex(searchText), "i")
      : null

    // Allowed sorting fields
    // here classId is mapped to className because the UI displays the human-readable class name rather than the ObjectId.
    const sortFields = {
      admissionNo: "admissionNo",
      firstName: "firstName",
      lastName: "lastName",
      gender: "gender",
      nationality: "nationality",
      curriculum: "curriculum",
      classId: "className",
      status: "status",
      allergies: "allergies",
      rollNo: "rollNo",
      academicYear: "academicYear",
      admissionDate: "admissionDate",
      dob: "dob",
      transportRequired: "transportRequired",
    }

    const sortField = sortFields[sortBy] || "admissionNo"

    const sortDirection = sortOrder === "desc" ? -1 : 1

    // Aggregation pipeline
    const pipeline = [
      {
        $match: baseMatch,
      },

      // My Student collection contains a classId reference, while the actual class name and section are stored in the Class collection.
      // Your $lookup stage joins the two collections.
      {
        $lookup: {
          from: "classes", // form:"MONGODB_COLLECTION_NAME" Specifies the collection to search.This is the MongoDB collection name, not necessarily the Mongoose model name.
          localField: "classId", // localField: "FIELD_NAME" Specifies the field in the Student documents.
          foreignField: "_id", // foreignField: "FIELD_NAME" Specifies the field in the Class documents to match against classId.
          as: "classInfo", // Stores the matching Class documents in a new array field called classInfo.
        },
      },

      // $unwind expands the classInfo array into separate documents.
      // after unwind you can use "$classInfo.name" and "$classInfo.section"
      {
        $unwind: {
          path: "$classInfo", // name of the array field which you want to expand
          preserveNullAndEmptyArrays: true, // Suppose a Student document has no matching Class document. Without this option, $unwind would remove the student from the pipeline.
        },
      },

      // This stage creates a computed field called className.
      {
        $set: {
          className: {
            $trim: {
              // Removes whitespace from the beginning and end of the combined string.
              input: {
                $concat: [
                  // $concat joins strings together.
                  { $ifNull: ["$classInfo.name", ""] }, // Use $classInfo.name if it is not null or missing. Otherwise, use an empty string.
                  " ",
                  { $ifNull: ["$classInfo.section", ""] },
                ],
              },
            },
          },
        },
      },
    ]

    // Include Search in pipeline
    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { admissionNo: searchRegex },
            { firstName: searchRegex },
            { lastName: searchRegex },
            { rollNo: searchRegex },
            { nationality: searchRegex },
            { curriculum: searchRegex },
            { academicYear: searchRegex },
            { languages: searchRegex },
            { address: searchRegex },
            { allergies: searchRegex },
            { className: searchRegex },
          ],
        },
      })
    }

    // Status-specific pipeline stages
    const statusStages = status ? [{ $match: { status } }] : []

    // Pagination
    const skip = (requestedPage - 1) * limit

    pipeline.push({
      // $facet allows MongoDB to run multiple aggregation pipelines over the same input documents and return their results together.
      /* This is especially useful in your Students page because the frontend needs three different outputs:
        1. The actual student records.
        2. The total number of records matching the current filters.
        3. The counts for all status tabs.
      Without $facet, you would typically run separate aggregation queries to obtain these results. */
      $facet: {
        data: [
          ...statusStages,
          {
            $sort: {
              [sortField]: sortDirection,
            },
          },
          {
            $skip: skip,
          },
          {
            $limit: limit,
          },
          {
            $project: {
              classInfo: 0,
            },
          },
        ],

        // Total records for current tab/filter
        total: [
          ...statusStages,

          {
            $count: "count",
          },
        ],

        statusCounts: [
          {
            $group: {
              _id: "$status",
              count: {
                $sum: 1,
              },
            },
          },
        ],
      },
    })

    const [result] = await Student.aggregate(pipeline)

    const total = result?.total?.[0]?.count || 0

    const totalPages = Math.max(1, Math.ceil(total / limit))

    const counts = {
      all: 0,
      active: 0,
      inactive: 0,
      transferred: 0,
      "passed-out": 0,
      suspended: 0,
    }

    // Object.prototype.hasOwnProperty.call(counts, item._id) This checks whether the status is an own property of the counts object.
    for (const item of result?.statusCounts || []) {
      if (Object.prototype.hasOwnProperty.call(counts, item._id)) {
        counts[item._id] = item.count
      }
    }

    counts.all =
      counts.active +
      counts.inactive +
      counts.transferred +
      counts["passed-out"] +
      counts.suspended

    const currentPage = total === 0 ? 1 : Math.min(requestedPage, totalPages)

    return res.json({
      data: result?.data || [],

      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
      },

      counts,
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id - Get single student
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const doc = await Student.findById(req.params.id)
    if (!doc) {
      return res.status(404).json({ error: "Student not found" })
    }

    const studentIdStr = doc._id.toString()
    const userRefIdStr = req.user.refId ? req.user.refId.toString() : ""

    // Students may only see themselves
    if (req.user.role === "student" && userRefIdStr !== studentIdStr) {
      return res.status(403).json({ error: "Forbidden" })
    }

    // Parents may only see their linked children
    if (req.user.role === "parent") {
      const parentIdsStr = (doc.parentIds || []).map((id) => id.toString())
      if (!parentIdsStr.includes(userRefIdStr)) {
        return res.status(403).json({ error: "Forbidden" })
      }
    }

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! POST /students - Create student & credentials
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  // This creates a MongoDB session.
  // A session allows multiple database operations to participate in a single transaction.
  // Suppose the student and parent are created successfully, but creating the student's login account fails.
  // Without a transaction, some documents might remain in the database even though the complete operation failed.
  // A transaction helps prevent this partial creation.
  const session = await mongoose.startSession()

  try {
    // Starts a transaction.
    session.startTransaction()

    const { loginPassword, parentPassword, ...others } = req.body

    if (!others.firstName || !others.classId) {
      // Abort the transaction
      await session.abortTransaction()
      return res
        .status(400)
        .json({ error: "Student name and class are required" })
    }

    if (!isValidObjectId(others.classId)) {
      // Abort the transaction
      await session.abortTransaction()
      return res.status(400).json({ error: "Invalid class ID format" })
    }

    const year = new Date().getFullYear()
    const seq = await nextSeq("admissionNo", session)
    const admissionNo = `${year}-${String(seq).padStart(8, "0")}`

    // starting a session does not automatically make every database operation part of that session.
    // You generally need to pass the session to database operations explicitly.
    // The .session(session) call associates this database operation with the current session.
    const klass = await Class.findById(others.classId).session(session)
    if (!klass) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Please select a valid class" })
    }
    const rollNo = await nextSeq(
      `${klass.name}${klass.section} - roll`,
      session,
    )

    const studentData = {
      ...others,
      admissionNo,
      rollNo,
      parentIds: [],
    }

    const student = new Student(studentData)
    await student.save({ session })

    const credentials = {}

    // Auto-create parent from inline parent details
    if (others.parentName && !student.parentIds.length) {
      let parent = others.parentMobile
        ? await Parent.findOne({ mobile: others.parentMobile }).session(session)
        : null

      if (!parent) {
        parent = new Parent({
          name: others.parentName,
          relation: others.parentRelation || "Guardian",
          mobile: others.parentMobile || "",
          email: others.parentEmail || "",
          occupation: others.parentOccupation || "",
          address: others.address || "",
          status: "active",
        })

        await parent.save({ session })

        const pSeq = await nextSeq("parentUser")
        const pUsername = `parent${pSeq}`
        const pPassword = parentPassword || "parent123"

        const parentUser = new User({
          username: pUsername,
          fullName: parent.name,
          role: "parent",
          status: "active",
          refId: parent._id,
          mobile: parent.mobile,
          email: parent.email,
          passwordHash: pPassword, // Handled by User pre-save hook
          address: others.address || "",
          gender:
            others.parentRelation === "Father"
              ? "Male"
              : others.parentRelation === "Mother"
                ? "Female"
                : "",
        })

        await parentUser.save({ session })

        credentials.parentUsername = pUsername
        credentials.parentPassword = pPassword
      }

      student.parentIds = [parent._id]
      await student.save({ session })
    }

    // Student login account
    const sSeq = await nextSeq("studentUser")
    const sUsername = `student${sSeq}`
    const sPassword = loginPassword || "student123"

    const studentUser = new User({
      username: sUsername,
      fullName: `${others.firstName} ${others.lastName || ""}`.trim(),
      role: "student",
      status: "active",
      refId: student._id,
      passwordHash: sPassword, // Handled by User pre-save hook
      gender: others.gender,
      address: others.address,
      dob: others.dob,
      joined: others.admissionDate,
    })

    await studentUser.save({ session })

    credentials.studentUsername = sUsername
    credentials.studentPassword = sPassword

    // Commits the transaction, making its changes permanent.
    await session.commitTransaction()

    return res.status(201).json({ ...student.toObject(), credentials })
  } catch (err) {
    // session.inTransaction() is a Mongoose method that checks whether the current MongoDB session has an active transaction.
    if (session.inTransaction()) {
      // Aborts the transaction, discarding its uncommitted database changes.
      await session.abortTransaction()
    }

    return next(err)
  } finally {
    await session.endSession()
  }
})

//! PUT /students/:id - Update student
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    if (!isValidObjectId(req.params.id)) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const studentObj = await Student.findById(req.params.id).session(session)

    if (!studentObj) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Student not found" })
    }

    const b = { ...req.body }
    delete b._id
    delete b.loginPassword
    delete b.parentPassword

    const studentData = {
      ...b,
    }

    if (b.classId && studentObj.classId.toString() !== b.classId) {
      const klass = await Class.findById(b.classId).session(session)

      if (!klass) {
        await session.abortTransaction()
        return res.status(400).json({ error: "Please select a valid class" })
      }

      const rollNo = await nextSeq(
        `${klass.name}${klass.section} - roll`,
        session,
      )

      studentData.rollNo = rollNo
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      studentData,
      {
        new: true,
        runValidators: true,
      },
    ).session(session)

    if (!updatedStudent) {
      await session.abortTransaction()
      return res.status(404).json({ error: "Student not found" })
    }

    await User.findOneAndUpdate(
      { refId: req.params.id },
      {
        fullName: b.firstName && `${b.firstName} ${b.lastName || ""}`.trim(),
        status: b.status,
        gender: b.gender,
        address: b.address,
        dob: b.dob,
        joined: b.admissionDate,
      },
      {
        new: true,
        runValidators: true,
      },
    ).session(session)

    await session.commitTransaction()

    return res.json(updatedStudent)
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction()
    }

    return next(err)
  } finally {
    await session.endSession()
  }
})

//! GET /students/:id/fees - Fee summary
router.get("/:id/fees", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const receipts = await FeeReceipt.find({
      studentId: req.params.id,
    }).sort({
      date: -1,
    })

    const structures = await FeeStructure.find()
    const student = await Student.findById(req.params.id)

    return res.json({
      receipts,
      structures,
      student,
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/attendance - Attendance summary
router.get("/:id/attendance", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const { from, to } = req.query
    const all = await Attendance.find()
    const records = []

    // continue is used inside a loop (for, while, do...while) to skip the remaining code of the current iteration and move directly to the next iteration.
    for (const day of all) {
      if (from && day.date < from) continue
      if (to && day.date > to) continue

      const rec = (day.records || []).find(
        (r) => r.studentId?.toString() === req.params.id,
      )
      if (rec) {
        records.push({
          date: day.date,
          status: rec.status,
          classId: day.classId,
        })
      }
    }

    records.sort((a, b) => (a.date < b.date ? 1 : -1))

    const summary = {}
    for (const r of records) {
      summary[r.status] = (summary[r.status] || 0) + 1
    }

    return res.json({
      records,
      summary,
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/results - Academic marks
router.get("/:id/results", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.id)
    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    const allMarks = await Mark.find({
      classId: student.classId,
    })

    const exams = await Exam.find()
    const subjects = await Subject.find()

    const visible = req.user.role === "student" || req.user.role === "parent"
    const results = []

    for (const m of allMarks) {
      if (visible && m.status !== "published") continue

      const entry = (m.entries || []).find(
        (e) => e.studentId?.toString() === req.params.id,
      )
      if (!entry) continue

      const exam = exams.find((e) => e._id.toString() === m.examId?.toString())
      const subject = subjects.find(
        (s) => s._id.toString() === m.subjectId?.toString(),
      )

      results.push({
        examId: m.examId,
        examName: exam?.name || "?",
        subject: subject?.name || "?",
        maxMarks: subject?.maxMarks || 100,
        marks: entry.marks,
        grade: entry.grade,
        status: m.status,
      })
    }

    return res.json({
      student,
      results,
    })
  } catch (err) {
    return next(err)
  }
})

//! GET /students/:id/parents - Linked parents
router.get("/:id/parents", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.id)
    if (!student) {
      return res.status(404).json({ error: "Student not found" })
    }

    const parents = await Parent.find({
      _id: { $in: student.parentIds || [] },
    })

    return res.json(parents)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /students/:id - Delete student
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  const session = await mongoose.startSession()

  try {
    session.startTransaction()

    if (!isValidObjectId(req.params.id)) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    await Student.findByIdAndDelete(req.params.id, { session })

    await User.findOneAndDelete(
      {
        role: "student",
        refId: req.params.id,
      },
      { session },
    )

    await session.commitTransaction()

    return res.json({ ok: true })
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction()
    }

    return next(err)
  } finally {
    await session.endSession()
  }
})

export default router
