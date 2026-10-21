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
  try {
    const b = req.body

    if (!b.firstName || !b.classAppliedFor || !b.academicYear) {
      return res.status(400).json({
        error:
          "Applicant name, class applied for and academic year are required",
      })
    }

    const seq = await nextSeq("registration")
    const regNo = `REG-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`

    const doc = await Admission.create({
      regNo,
      status: "registered",
      ...b,
    })

    return res.status(201).json(doc)
  } catch (err) {
    return next(err)
  }
})

//! PUT /admissions/:id - Update application details
router.put("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid application ID format" })
    }

    const b = { ...req.body }
    delete b._id

    const updated = await Admission.findByIdAndUpdate(req.params.id, b, {
      new: true,
      runValidators: true,
    })

    if (!updated) {
      return res.status(404).json({ error: "Not found" })
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
      return res.status(400).json({ error: "Invalid application ID format" })
    }

    const updated = await Admission.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectReason: req.body.reason || "Not specified",
      },
      { new: true, runValidators: true },
    )

    if (!updated) {
      return res.status(404).json({ error: "Not found" })
    }

    return res.json(updated)
  } catch (err) {
    return next(err)
  }
})

//! POST /admissions/:id/enroll - Enroll applicant into class
router.post("/:id/enroll", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid application ID format" })
    }

    const app = await Admission.findById(req.params.id)
    if (!app) {
      return res.status(404).json({ error: "Application not found" })
    }

    if (app.status === "admitted") {
      return res.status(400).json({ error: "Applicant is already admitted" })
    }

    const {
      classId,
      admissionDate,
      transportRequired,
      transportRoute,
      studentPassword,
      parentPassword,
    } = req.body

    if (!classId || !isValidObjectId(classId)) {
      return res.status(400).json({ error: "Please select a valid class" })
    }

    const klass = await Class.findById(classId)
    if (!klass) {
      return res.status(400).json({ error: "Please select a valid class" })
    }

    const rollNo = await nextSeq(`${klass.name} - roll`)

    const year = new Date().getFullYear()
    const seq = await nextSeq("admissionNo")
    const admNo = `${year}-${String(seq).padStart(8, "0")}`
    const credentials = {}

    // 1) Parent (reuse by mobile if the same parent already exists)
    let parent = null
    if (app.parentMobile) {
      parent = await Parent.findOne({ mobile: app.parentMobile })
    }

    if (!parent) {
      parent = await Parent.create({
        name: app.parentName || "Guardian",
        relation: app.parentRelation || "Guardian",
        mobile: app.parentMobile || "",
        email: app.parentEmail || "",
        occupation: app.parentOccupation || "",
        address: app.address || "",
        status: "active",
      })

      const pSeq = await nextSeq("parentUser")
      const pUsername = `parent${pSeq}`
      const pPassword = parentPassword || "parent123"

      await User.create({
        username: pUsername,
        fullName: parent.name,
        role: "parent",
        status: "active",
        email: parent.email,
        mobile: parent.mobile,
        refId: parent._id,
        passwordHash: pPassword, // Password hashing handled by User model pre-save hook
      })

      credentials.parentUsername = pUsername
      credentials.parentPassword = pPassword
    }

    // 2) Student record
    const student = await Student.create({
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
      transportRequired: Boolean(transportRequired),
      transportRoute: transportRoute || "",
      parentIds: [parent._id],
      academicYear: app.academicYear || klass.academicYear,
      status: "active",
    })

    // 3) Student login
    const sSeq = await nextSeq("studentUser")
    const sUsername = `student${sSeq}`
    const sPassword = studentPassword || "student123"

    await User.create({
      username: sUsername,
      fullName: `${app.firstName} ${app.lastName || ""}`.trim(),
      role: "student",
      status: "active",
      refId: student._id,
      passwordHash: sPassword, // Password hashing handled by User model pre-save hook
    })

    credentials.studentUsername = sUsername
    credentials.studentPassword = sPassword

    // Update admission application status
    app.status = "admitted"
    app.studentId = student._id
    app.admissionNo = admNo
    app.enrolledClassId = classId
    await app.save()

    return res.json({ admission: app, student, credentials })
  } catch (err) {
    return next(err)
  }
})

//! DELETE /admissions/:id - Delete application
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid application ID format" })
    }

    const deleted = await Admission.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: "Application not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
