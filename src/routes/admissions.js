// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Admission } from "../models/Admission.js"
import { Student } from "../models/Student.js"
import { Parent } from "../models/Parent.js"
import { User } from "../models/User.js"
import { Class } from "../models/Class.js"
import { nextSeq } from "../models/Counter.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /admissions - List admission applications
router.get("/", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const filters = {}

    if (req.query.status) {
      filters.status = String(req.query.status)
    }

    // Sirf query object create hota hain query execute nehi hota
    let query = Admission.find(filters)
      .sort({
        createdAt: -1,
      })
      .lean()

    // await query ko trigger karta hain fir query execute hota hain
    // await, .then() aur .exec() query execution ke common tareeke hain.
    const admissions = await query

    return res.json(admissions)
  } catch (err) {
    return next(err)
  }
})

//! POST /admissions - New registration
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  let session
  const b = req.body

  try {
    session = await mongoose.startSession()

    session.startTransaction()

    const seq = await nextSeq("registration", session)

    const regNo = `REG-${new Date().getFullYear()}-${String(seq).padStart(
      5,
      "0",
    )}`

    const [doc] = await Admission.create(
      [
        {
          ...b,
          regNo,
          status: "registered",
        },
      ],
      { session },
    )

    await session.commitTransaction()

    return res.status(201).json(doc)
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction()
    }

    return next(err)
  } finally {
    await session.endSession()
  }
})

//! PUT /admissions/:id - Update admission application
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { id } = req.params

    // 1. Validate the application ID.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid application ID format",
      })
    }

    // 2. Define the fields that staff are allowed to update.
    const allowedFields = [
      "firstName",
      "lastName",
      "gender",
      "dob",
      "nationality",
      "curriculum",
      "classAppliedFor",
      "academicYear",
      "address",
      "allergies",
      "medicalNotes",
      "parentName",
      "parentRelation",
      "parentMobile",
      "parentEmail",
      "parentOccupation",
    ]

    // 3. Build an update object using only whitelisted fields.
    const updates = {}

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field]
      }
    }

    // 4. Reject requests that contain no permitted fields.
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided for update",
      })
    }

    // 5. Find the existing admission application.
    const admission = await Admission.findById(id)

    if (!admission) {
      return res.status(404).json({
        message: "Admission application not found",
      })
    }

    // 6. Only registered applications can be updated.
    if (admission.status !== "registered") {
      return res.status(400).json({
        message: "Only registered admission applications can be updated",
      })
    }

    // 7. Apply the permitted updates.
    const updatedAdmission = await Admission.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        returnDocument: "after",
        runValidators: true,
      },
    )

    if (!updatedAdmission) {
      return res.status(404).json({
        message: "Admission application not found",
      })
    }

    // 8. Return the updated application.
    return res.status(200).json(updatedAdmission)
  } catch (err) {
    next(err)
  }
})

//! POST /admissions/:id/reject - Reject an admission application
router.post("/:id/reject", allowRoles(...STAFF), async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    // 1. Validate the application ID.
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid application ID format",
      })
    }

    // 2. Require a rejection reason.
    if (typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        message: "Rejection reason is required",
      })
    }

    // 3. Reject only if the application is still registered.
    const rejectedAdmission = await Admission.findOneAndUpdate(
      {
        _id: id,
        status: "registered",
      },
      {
        $set: {
          status: "rejected",
          rejectReason: reason.trim(),
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    )

    // 4. Handle missing applications or invalid status.
    if (!rejectedAdmission) {
      const admission = await Admission.findById(id).select("status").lean()

      if (!admission) {
        return res.status(404).json({
          message: "Admission application not found",
        })
      }

      return res.status(400).json({
        message: "Only registered admission applications can be rejected",
      })
    }

    // 5. Return the updated application.
    return res.status(200).json(rejectedAdmission)
  } catch (err) {
    next(err)
  }
})

//! POST /admissions/:id/enroll - Enroll applicant into class
router.post("/:id/enroll", allowRoles(...STAFF), async (req, res, next) => {
  const { id } = req.params

  // Validate ID before starting transaction
  if (!isValidObjectId(id)) {
    return res.status(400).json({
      error: "Invalid application ID format",
    })
  }

  const {
    classId,
    admissionDate,
    transportRequired,
    transportRoute,
    studentPassword,
    parentPassword,
  } = req.body

  // Validate class ID before starting transaction
  if (!classId || !isValidObjectId(classId)) {
    return res.status(400).json({
      error: "Please select a valid class",
    })
  }

  let session

  try {
    session = await mongoose.startSession()

    // Starts a transaction.
    session.startTransaction()

    // Find the admission application within the transaction.
    const app = await Admission.findById(id).session(session)

    if (!app) {
      await session.abortTransaction()
      return res.status(404).json({ error: "Application not found" })
    }

    // Only registered applications can be enrolled.
    if (app.status !== "registered") {
      await session.abortTransaction()
      return res.status(400).json({
        error: "Only registered admission applications can be enrolled",
      })
    }

    // Find class
    const klass = await Class.findById(classId).session(session)

    if (!klass) {
      await session.abortTransaction()
      return res.status(400).json({ error: "Please select a valid class" })
    }

    // Generate roll number
    const rollNo = await nextSeq(
      `${klass.name}${klass.section} - roll`,
      session,
    )

    // Generate admission number
    const year = new Date().getFullYear()
    const seq = await nextSeq("admissionNo", session)
    const admNo = `${year}-${String(seq).padStart(8, "0")}`

    // Stores parent and student credentials (username and password)
    const credentials = {}

    // Parent
    let parent = null

    if (app.parentMobile) {
      parent = await Parent.findOne({
        mobile: app.parentMobile,
      }).session(session)
    }

    if (!parent) {
      parent = new Parent({
        name: app.parentName || "Guardian",
        relation: app.parentRelation || "Guardian",
        mobile: app.parentMobile || "",
        email: app.parentEmail || "",
        occupation: app.parentOccupation || "",
        address: app.address || "",
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
        email: parent.email,
        mobile: parent.mobile,
        refId: parent._id,
        passwordHash: pPassword,
        // Password hashing handled by User model pre-save hook
        address: app.address || "",
        gender:
          app.parentRelation === "Father"
            ? "Male"
            : app.parentRelation === "Mother"
              ? "Female"
              : null,
      })

      await parentUser.save({ session })

      credentials.parentUsername = pUsername
      credentials.parentPassword = pPassword
    }

    // Student record
    const createdStudent = new Student({
      admissionNo: admNo,
      firstName: app.firstName,
      lastName: app.lastName || "",
      gender: app.gender || "",
      dob: app.dob || "",
      nationality: app.nationality || "",
      curriculum: app.curriculum || "",
      englishLevel: app.englishLevel || "",
      house: app.house || "",
      allergies: app.allergies || "",
      medicalNotes: app.medicalNotes || "",
      languages: app.languages || "",
      address: app.address || "",
      classId,
      rollNo: rollNo || "",
      admissionDate: admissionDate || new Date().toISOString().slice(0, 10),
      transportRequired,
      transportRoute: transportRoute || "",
      parentIds: [parent._id],
      academicYear: app.academicYear || klass.academicYear,
      status: "active",
    })

    await createdStudent.save({ session })

    const sSeq = await nextSeq("studentUser", session)
    const sUsername = `student${sSeq}`
    const sPassword = studentPassword

    const studentUser = new User({
      username: sUsername,
      fullName: `${app.firstName} ${app.lastName || ""}`.trim(),
      role: "student",
      status: "active",
      refId: createdStudent._id,
      passwordHash: sPassword,
      // Password hashing handled by User model pre-save hook
      gender: app.gender,
      address: app.address,
      dob: app.dob,
      joined: admissionDate || new Date().toISOString().slice(0, 10),
    })

    await studentUser.save({ session })

    credentials.studentUsername = sUsername
    credentials.studentPassword = sPassword

    // Update admission application
    const updatedAdmission = await Admission.findOneAndUpdate(
      {
        _id: app._id,
        status: "registered",
      },
      {
        $set: {
          status: "admitted",
          studentId: createdStudent._id,
          admissionNo: admNo,
          enrolledClassId: classId,
        },
      },
      {
        session,
        returnDocument: "after",
        runValidators: true,
      },
    )

    if (!updatedAdmission) {
      await session.abortTransaction()
      return res.status(404).json({
        error: "Only registered admission applications can be enrolled",
      })
    }

    // Commits the transaction, making its changes permanent.
    await session.commitTransaction()

    // Transaction successfully committed
    return res.json({
      admission: app,
      student: createdStudent,
      credentials,
    })
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

//! DELETE /admissions/:id - Delete application
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid application ID format",
      })
    }

    const deleted = await Admission.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({
        error: "Application not found",
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
