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
    const query = {}
    if (req.query.status) {
      query.status = String(req.query.status)
    }

    const admissions = await Admission.find(query).sort({ createdAt: -1 })
    return res.json(admissions)
  } catch (err) {
    return next(err)
  }
})

//! POST /admissions - New registration
router.post("/", allowRoles(...STAFF), async (req, res, next) => {
  const b = req.body

  // Validate before starting transaction
  if (!b.firstName || !b.classAppliedFor || !b.academicYear) {
    return res.status(400).json({
      error: "Applicant name, class applied for and academic year are required",
    })
  }

  const session = await mongoose.startSession()

  try {
    let createdAdmission

    await session.withTransaction(async () => {
      const seq = await nextSeq("registration", session)

      const regNo = `REG-${new Date().getFullYear()}-${String(seq).padStart(
        5,
        "0",
      )}`

      const [doc] = await Admission.create(
        [
          {
            regNo,
            status: "registered",
            ...b,
          },
        ],
        { session },
      )

      createdAdmission = doc
    })

    return res.status(201).json(createdAdmission)
  } catch (err) {
    return next(err)
  } finally {
    await session.endSession()
  }
})

//! PUT /admissions/:id - Update application details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid application ID format",
      })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await Admission.findByIdAndUpdate(req.params.id, b, {
      returnDocument: "after",
      runValidators: true,
    })

    if (!updated) {
      return res.status(404).json({
        error: "Not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! POST /admissions/:id/reject - Reject application
router.post("/:id/reject", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        error: "Invalid application ID format",
      })
    }

    const updated = await Admission.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectReason: req.body.reason || "Not specified",
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    )

    if (!updated) {
      return res.status(404).json({
        error: "Not found",
      })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
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

  const session = await mongoose.startSession()

  try {
    let result

    await session.withTransaction(async () => {
      // --------------------------------------------------
      // 1. Find admission inside transaction
      // --------------------------------------------------

      const app = await Admission.findById(id).session(session)

      if (!app) {
        const error = new Error("Application not found")
        error.statusCode = 404
        throw error
      }

      if (app.status === "admitted") {
        const error = new Error("Applicant is already admitted")
        error.statusCode = 400
        throw error
      }

      // --------------------------------------------------
      // 2. Find class inside transaction
      // --------------------------------------------------

      const klass = await Class.findById(classId).session(session)

      if (!klass) {
        const error = new Error("Please select a valid class")
        error.statusCode = 400
        throw error
      }

      // --------------------------------------------------
      // 3. Generate roll number inside transaction
      // --------------------------------------------------
      const rollNo = await nextSeq(
        `${klass.name}${klass.section} - roll`,
        session,
      )
      // --------------------------------------------------
      // 4. Generate admission number inside transaction
      // --------------------------------------------------
      const year = new Date().getFullYear()
      const seq = await nextSeq("admissionNo", session)
      const admNo = `${year}-${String(seq).padStart(8, "0")}`
      const credentials = {}
      // --------------------------------------------------
      // 5. Parent
      // --------------------------------------------------
      let parent = null

      if (app.parentMobile) {
        parent = await Parent.findOne({
          mobile: app.parentMobile,
        }).session(session)
      }

      if (!parent) {
        const [createdParent] = await Parent.create(
          [
            {
              name: app.parentName || "Guardian",
              relation: app.parentRelation || "Guardian",
              mobile: app.parentMobile || "",
              email: app.parentEmail || "",
              occupation: app.parentOccupation || "",
              address: app.address || "",
              status: "active",
            },
          ],
          { session },
        )

        parent = createdParent

        // --------------------------------------------------
        // 6. Parent login
        // --------------------------------------------------
        const pSeq = await nextSeq("parentUser", session)
        const pUsername = `parent${pSeq}`
        const pPassword = parentPassword || "parent123"

        await User.create(
          [
            {
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
            },
          ],
          { session },
        )

        credentials.parentUsername = pUsername
        credentials.parentPassword = pPassword
      }

      // --------------------------------------------------
      // 7. Student record
      // --------------------------------------------------

      const student = await Student.create(
        [
          {
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
            admissionDate:
              admissionDate || new Date().toISOString().slice(0, 10),
            transportRequired,
            transportRoute: transportRoute || "",
            parentIds: [parent._id],
            academicYear: app.academicYear || klass.academicYear,
            status: "active",
          },
        ],
        { session },
      )

      const createdStudent = student[0]

      // --------------------------------------------------
      // 8. Student login
      // --------------------------------------------------
      const sSeq = await nextSeq("studentUser", session)
      const sUsername = `student${sSeq}`
      const sPassword = studentPassword || "student123"

      await User.create(
        [
          {
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
          },
        ],
        { session },
      )

      credentials.studentUsername = sUsername
      credentials.studentPassword = sPassword

      // --------------------------------------------------
      // 9. Update admission application
      // --------------------------------------------------

      app.status = "admitted"
      app.studentId = createdStudent._id
      app.admissionNo = admNo
      app.enrolledClassId = classId
      
      await app.save({ session })

      // --------------------------------------------------
      // 10. Store result
      // --------------------------------------------------

      result = {
        admission: app,
        student: createdStudent,
        credentials,
      }
    })

    // Transaction successfully committed
    return res.json(result)
  } catch (err) {
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
