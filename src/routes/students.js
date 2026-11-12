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
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { studentCreateSchema } from "../schema/Students.schema.js"
import { studentUpdateSchema } from "../schema/StudentsUpdate.schema.js"
import { Settings } from "../models/Settings.js"

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

      const docs = await Student.find(query).sort({ admissionNo: 1 }).lean()

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
    // If you added baseMatch.status = status then the entire aggregation would be restricted to the selected status.
    // Consequently, the statusCounts calculation would only see active students when the active tab was selected.
    // We need status counts for all statuses even when the currently selected StatusTab is only "active"
    const baseMatch = {}

    if (classId) {
      baseMatch.classId = new mongoose.Types.ObjectId(classId)
    }

    if (gender) {
      baseMatch.gender = gender
    }

    // "\\S" => string containing at least one non-whitespace character.
    // $regex and $options are MongoDB query operators.
    if (hasAllergies === "true") {
      baseMatch.allergies = {
        $regex: "\\S",
      }
    }

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

    // Aggregation pipeline
    const pipeline = [
      {
        $match: searchRegex
          ? {
              ...baseMatch,
              $or: [
                { admissionNo: searchRegex }, // Does searchRegex occur anywhere inside admissionNo, case-insensitively?
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
            }
          : baseMatch,
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
                // We use input because MongoDB's $trim operator requires us to specify which string it should remove whitespace from.
                $concat: [
                  // $concat joins strings together.
                  { $ifNull: ["$classInfo.name", ""] }, // Use $classInfo.name if it is not null, undefined or missing. Otherwise, use an empty string.
                  " ",
                  { $ifNull: ["$classInfo.section", ""] },
                ],
              },
            },
          },
        },
      },
    ]

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

    // Status-specific pipeline stages
    const statusStages = status ? [{ $match: { status } }] : []

    // Pagination
    const requestedPage = Math.max(1, Number.parseInt(pageParam, 10) || 1)
    const allowedPageSizes = [10, 25, 50, 100]
    let limit = Number.parseInt(limitParam, 10) || 10

    if (!allowedPageSizes.includes(limit)) {
      limit = 10
    }

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
router.post(
  "/",
  allowRoles(...STAFF),
  SchemaValidation(studentCreateSchema),
  async (req, res, next) => {
    let session
    try {
      // This creates a MongoDB session.
      // A session allows multiple database operations to participate in a single transaction.
      // Suppose the student and parent are created successfully, but creating the student's login account fails.
      // Without a transaction, some documents might remain in the database even though the complete operation failed.
      // A transaction helps prevent this partial creation.
      session = await mongoose.startSession()

      // Starts a transaction.
      session.startTransaction()

      const { loginPassword, parentPassword, ...others } = req.body

      if (
        !others.firstName ||
        !others.classId ||
        !others.gender ||
        !others.dob ||
        !others.curriculum ||
        !others.admissionDate ||
        !others.academicYear ||
        !others.address
      ) {
        // Abort the transaction
        await session.abortTransaction()
        return res.status(400).json({ error: "Required fields must be pass" })
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
      // transaction ke andar kiye gaye reads ko bhi usi session se associate karna, taaki woh transaction ke context mein execute hon.
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
      if (others.parentName) {
        let parent = others.parentMobile
          ? await Parent.findOne({ mobile: others.parentMobile }).session(
              session,
            )
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

          const pSeq = await nextSeq("parentUser", session)
          const pUsername = `parent${pSeq}`
          const pPassword = parentPassword

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
      const sSeq = await nextSeq("studentUser", session)
      const sUsername = `student${sSeq}`
      const sPassword = loginPassword

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
  },
)

//! PUT /students/:id - Update student
router.put(
  "/:id",
  allowRoles(...STAFF),
  SchemaValidation(studentUpdateSchema),
  async (req, res, next) => {
    let session

    try {
      // Step 1: Validate student ID.
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          error: "Invalid student ID format",
        })
      }

      // Reject an empty update request.
      if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: "At least one field is required to update the student",
        })
      }

      // Step 5: Start MongoDB transaction.
      session = await mongoose.startSession()

      session.startTransaction()

      // Step 6: Find the existing student.
      const studentObj = await Student.findById(req.params.id).session(session)

      if (!studentObj) {
        await session.abortTransaction()

        return res.status(404).json({
          error: "Student not found",
        })
      }

      // Step 7: Copy the validated request body.
      // Unexpected fields have already been rejected.
      const studentData = {
        ...req.body,
      }

      // Step 8: Validate the class if classId is being changed.
      if (
        studentData.classId &&
        studentObj.classId.toString() !== studentData.classId
      ) {
        if (!isValidObjectId(studentData.classId)) {
          await session.abortTransaction()

          return res.status(400).json({
            error: "Invalid class ID format",
          })
        }

        const klass = await Class.findById(studentData.classId).session(session)

        if (!klass) {
          await session.abortTransaction()

          return res.status(400).json({
            error: "Please select a valid class",
          })
        }

        // Generate a new roll number for the selected class.
        const rollNo = await nextSeq(
          `${klass.name}${klass.section} - roll`,
          session,
        )

        studentData.rollNo = rollNo
      }

      // Step 9: Update the Student document.
      const updatedStudent = await Student.findByIdAndUpdate(
        req.params.id,
        studentData,
        {
          returnDocument: "after",
          runValidators: true,
        },
      ).session(session)

      if (!updatedStudent) {
        await session.abortTransaction()

        return res.status(404).json({
          error: "Student not found",
        })
      }

      // Step 10: Update the corresponding student User document.
      await User.findOneAndUpdate(
        {
          role: "student",
          refId: req.params.id,
        },
        {
          ...(studentData.firstName !== undefined && {
            fullName:
              `${studentData.firstName} ${studentData.lastName ?? studentObj.lastName ?? ""}`.trim(),
          }),

          ...(studentData.status !== undefined && {
            status: studentData.status,
          }),

          ...(studentData.gender !== undefined && {
            gender: studentData.gender,
          }),

          ...(studentData.address !== undefined && {
            address: studentData.address,
          }),

          ...(studentData.dob !== undefined && {
            dob: studentData.dob,
          }),

          ...(studentData.admissionDate !== undefined && {
            joined: studentData.admissionDate,
          }),
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      )

      // Step 11: Commit the transaction.
      await session.commitTransaction()

      // Step 12: Return the updated student.
      return res.status(200).json(updatedStudent)
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

//! GET /students/:id/fees - Fee summary
router.get(
  "/:id/fees",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid student ID format" })
      }

      const student = await Student.findById(req.params.id)

      if (!student) {
        return res.status(404).json({ error: "Student not found" })
      }

      const doc = await Settings.findOne({ key: "school" }).lean()

      const receipts = await FeeReceipt.find({
        studentId: req.params.id,
        academicYear: doc.value.academicYear,
      }).sort({
        date: -1,
      })

      const structures = await FeeStructure.find()

      return res.json({
        receipts,
        structures,
        student,
      })
    } catch (err) {
      return next(err)
    }
  },
)

//! GET /students/:id/attendance - Attendance summary
router.get(
  "/:id/attendance",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const { id } = req.params
      const { from, to } = req.query

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error: "Invalid student ID format",
        })
      }

      const student = await Student.findById(id)

      if (!student) {
        return res.status(404).json({ error: "Student not found" })
      }

      // Build the date filter.
      const match = {}

      if (from || to) {
        match.date = {}

        if (from) {
          match.date.$gte = from
        }

        if (to) {
          match.date.$lte = to
        }
      }

      // Find only attendance documents containing this student.
      const pipeline = [
        {
          $match: {
            ...match,
            classId: student.classId,
            "records.studentId": new mongoose.Types.ObjectId(id),
          },
        },

        // Extract only the requested student's attendance record.
        // In MongoDB aggregation expressions, a single $ before a field name refers to that field's value.
        {
          $project: {
            _id: 0,
            date: 1,
            classId: 1,
            records: {
              // Creates a new output field called records.
              $filter: {
                input: "$records", // This tells MongoDB which array to filter.
                as: "record", // This defines a variable named record that represents each individual element of the array while MongoDB evaluates the filter condition.
                cond: {
                  // The cond property defines the condition an array element must satisfy to remain in the filtered array.
                  // record is a variable defined inside the $filter stage MongoDB uses $$ to access variables.
                  $eq: ["$$record.studentId", new mongoose.Types.ObjectId(id)], // "$$record.studentId" refers to the studentId property of the current array element represented by the record variable.
                },
              },
            },
          },
        },

        // Convert the single matching record into an object.
        // "$records.status" means Retrieves the status values from the records array. here records is array of objects inside of that object status property is present so $records.status gives array like ["present", "absent", "late"] this.
        // $arrayElemAt retrieves an element from an array at a specified index. $arrayElemAt: ["$records.status", 0] Here, it retrieves the first element (index 0) from the array of attendance statuses.
        {
          $project: {
            date: 1,
            classId: 1,
            status: {
              // Creates a new output field called status.
              $arrayElemAt: ["$records.status", 0],
            },
          },
        },

        // Return the newest attendance dates first.
        {
          $sort: {
            date: -1,
          },
        },
      ]

      const records = await Attendance.aggregate(pipeline)

      // Calculate the attendance summary.
      const summary = {}

      for (const record of records) {
        summary[record.status] = (summary[record.status] || 0) + 1
      }

      return res.json({
        records,
        summary,
      })
    } catch (err) {
      return next(err)
    }
  },
)

//! GET /students/:id/results - Academic marks
router.get(
  "/:id/results",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const { id } = req.params

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error: "Invalid student ID format",
        })
      }

      // Find the requested student.
      const student = await Student.findById(id).lean()

      if (!student) {
        return res.status(404).json({
          error: "Student not found",
        })
      }

      // Students and parents can see only published results.
      const visible = req.user.role === "student" || req.user.role === "parent"

      // Fetch only marks belonging to the student's class that contain an entry for this student.
      const markQuery = {
        classId: student.classId,
        "entries.studentId": student._id,
      }

      if (visible) {
        markQuery.status = "published"
      }

      const marks = await Mark.find(markQuery).lean()

      // If the student has no matching marks, avoid querying the Exam and Subject collections.
      if (marks.length === 0) {
        return res.json({
          student,
          results: [],
        })
      }

      // Collect unique exam and subject IDs from the matching marks.
      const examIds = [
        ...new Set(marks.map((mark) => mark.examId.toString())),
      ].map((examId) => new mongoose.Types.ObjectId(examId))

      const subjectIds = [
        ...new Set(marks.map((mark) => mark.subjectId.toString())),
      ].map((subjectId) => new mongoose.Types.ObjectId(subjectId))

      // Fetch only the required exams and their names.
      const exams = await Exam.find({
        _id: { $in: examIds },
      })
        .select("name")
        .lean()

      // Fetch only the required subjects and their relevant fields.
      const subjects = await Subject.find({
        _id: { $in: subjectIds },
      })
        .select("name maxMarks")
        .lean()

      // Build lookup maps for efficient access.
      const examMap = new Map(exams.map((exam) => [exam._id.toString(), exam]))

      const subjectMap = new Map(
        subjects.map((subject) => [subject._id.toString(), subject]),
      )

      const results = []

      for (const mark of marks) {
        // Find this student's entry in the mark document.
        const entry = (mark.entries || []).find(
          (item) => item.studentId?.toString() === student._id.toString(),
        )

        if (!entry) continue

        const exam = examMap.get(mark.examId?.toString())
        const subject = subjectMap.get(mark.subjectId?.toString())

        results.push({
          examId: mark.examId,
          examName: exam?.name || "?",
          subject: subject?.name || "?",
          maxMarks: subject?.maxMarks || 100,
          marks: entry.marks,
          grade: entry.grade,
          status: mark.status,
        })
      }

      return res.json({
        student,
        results,
      })
    } catch (err) {
      return next(err)
    }
  },
)

//! GET /students/:id/parents - Linked parents
router.get(
  "/:id/parents",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
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
  },
)

//! DELETE /students/:id - Delete student
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  let session
  try {
    session = await mongoose.startSession()

    session.startTransaction()

    if (!isValidObjectId(req.params.id)) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Invalid student ID format" })
    }

    const student = await Student.findById(req.params.id)
    
    if (!student) {
      await session.abortTransaction()
      return res.status(404).json({ error: "Student not found" })
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
