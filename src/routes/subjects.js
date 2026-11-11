// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Subject } from "../models/Subject.js"
// middleware imports
import { authRequired, allowRoles, STAFF } from "../middleware/auth.js"
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { subjectCreateSchema } from "../schema/SubjectCreate.schema.js"
import { subjectUpdateSchema } from "../schema/SubjectUpdate.schema.js"

const router = Router()
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/subjects - Find all subjects
router.get("/", async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 }).lean()
    return res.json(subjects)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/subjects/:id - Find single subject by ID
router.get("/:id", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject ID format" })
    }

    const subject = await Subject.findById(req.params.id).lean()

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" })
    }

    return res.json(subject)
  } catch (err) {
    return next(err)
  }
})

//! POST /api/subjects/ - Create subject
router.post(
  "/",
  allowRoles(...STAFF),
  SchemaValidation(subjectCreateSchema),
  async (req, res, next) => {
    try {
      const { name, code, category, classIds, maxMarks, passingMarks } =
        req.body

      // Verify that all referenced classes exist
      const existingClasses = await Class.find({
        _id: { $in: classIds },
      })
        .select("_id")
        .lean()

      if (existingClasses.length !== classIds.length) {
        return res.status(400).json({
          error: "One or more referenced classes do not exist",
        })
      }

      // Normalize code before duplicate check
      const normalizedCode = code.trim().toUpperCase()

      // Check duplicate subject code
      const existingSubject = await Subject.findOne({
        code: normalizedCode,
      })

      if (existingSubject) {
        return res.status(409).json({
          error: "Subject code already exists",
        })
      }

      const subject = await Subject.create({
        name: name.trim(),
        code: normalizedCode,
        category: category || "Core",
        classIds,
        maxMarks,
        passingMarks,
      })

      return res.status(201).json(subject)
    } catch (err) {
      return next(err)
    }
  },
)

//! PUT /api/subjects/:id - Update given subject fields
router.put(
  "/:id",
  allowRoles(...STAFF),
  SchemaValidation(subjectUpdateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params

      // Validate subject ID
      if (!isValidObjectId(id)) {
        return res.status(400).json({
          error: "Invalid subject ID format",
        })
      }

      const body = { ...req.body }

      // Prevent _id from being modified
      delete body._id

      const update = {}

      // Validate and update subject name
      if (body.name !== undefined) {
        if (!body.name.trim()) {
          return res.status(400).json({
            error: "Subject name is required",
          })
        }

        update.name = body.name.trim()
      }

      // Validate and update subject code
      if (body.code !== undefined) {
        if (!body.code.trim()) {
          return res.status(400).json({
            error: "Subject code is required",
          })
        }

        const normalizedCode = body.code.trim().toUpperCase()

        // Check duplicate code excluding current subject
        const existingSubject = await Subject.findOne({
          code: normalizedCode,
          _id: { $ne: id },
        })

        if (existingSubject) {
          return res.status(409).json({
            error: "Subject code already exists",
          })
        }

        update.code = normalizedCode
      }

      // Validate and update category
      if (body.category !== undefined) {
        update.category = body.category
      }

      // Validate and update classIds
      if (body.classIds !== undefined) {
        // Verify that all referenced classes exist
        const existingClasses = await Class.find({
          _id: { $in: body.classIds },
        })
          .select("_id")
          .lean()

        if (existingClasses.length !== body.classIds.length) {
          return res.status(400).json({
            error: "One or more referenced classes do not exist",
          })
        }

        update.classIds = body.classIds
      }

      // Validate and update maxMarks
      if (body.maxMarks !== undefined) {
        update.maxMarks = body.maxMarks
      }

      // Validate and update passingMarks
      if (body.passingMarks !== undefined) {
        update.passingMarks = body.passingMarks
      }

      // Validate final maxMarks and passingMarks combination
      if (body.maxMarks !== undefined || body.passingMarks !== undefined) {
        const existingSubject = await Subject.findById(id).lean()

        if (!existingSubject) {
          return res.status(404).json({
            error: "Subject not found",
          })
        }

        const finalMaxMarks =
          body.maxMarks !== undefined ? body.maxMarks : existingSubject.maxMarks

        const finalPassingMarks =
          body.passingMarks !== undefined
            ? body.passingMarks
            : existingSubject.passingMarks

        if (finalPassingMarks > finalMaxMarks) {
          return res.status(400).json({
            error: "Passing marks cannot exceed maximum marks",
          })
        }
      }

      const updated = await Subject.findByIdAndUpdate(
        id,
        {
          $set: update,
        },
        {
          new: true,
          runValidators: true,
        },
      ).lean()

      if (!updated) {
        return res.status(404).json({
          error: "Subject not found",
        })
      }

      return res.json(updated)
    } catch (err) {
      return next(err)
    }
  },
)

//! DELETE /api/subjects/:id - Delete subject by ID
router.delete("/:id", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject ID format" })
    }

    const deleted = await Subject.findByIdAndDelete(req.params.id)

    if (!deleted) {
      return res.status(404).json({ error: "Subject not found" })
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
