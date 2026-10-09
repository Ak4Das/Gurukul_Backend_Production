// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { Timetable } from "../models/Timetable.js"
// middleware imports
import {
  authRequired,
  allowRoles,
  STAFF_TEACHER,
  STAFF,
} from "../middleware/auth.js"

const router = Router()

// Require authentication for all timetable endpoints
router.use(authRequired)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /api/timetables - List all timetables
router.get("/", async (req, res, next) => {
  try {
    const timetables = await Timetable.find().sort({ createdAt: -1 }).lean()
    return res.json(timetables)
  } catch (err) {
    return next(err)
  }
})

//! GET /api/timetables/:classId - Get timetable by classId
router.get("/:classId", async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.classId)) {
      return res.status(400).json({ error: "Invalid class ID" })
    }

    const doc = await Timetable.findOne({ classId: req.params.classId }).lean()
    return res.json(doc || { classId: req.params.classId, periods: [] })
  } catch (err) {
    return next(err)
  }
})

//! POST /api/timetables/:classId - Create a new timetable for a particular class
router.post("/:classId", allowRoles(...STAFF), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.classId)) {
      return res.status(400).json({ error: "Invalid class ID" })
    }

    const payload = {
      classId: req.params.classId,
      periods: req.body.periods || [],
    }

    // If classId not match with any document then new document will create since { upsert: true } is mentioned
    const doc = await Timetable.findOneAndUpdate(
      { classId: req.params.classId },
      { $set: payload },
      { new: true, upsert: true, runValidators: true },
    ).lean()

    return res.json(doc)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /api/timetables/:id - Delete timetable
router.delete(
  "/:classId",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.classId)) {
        return res.status(400).json({ error: "Invalid classId format" })
      }
      const deleted = await Timetable.findOneAndDelete({
        classId: req.params.classId,
      }).lean()
      if (!deleted) {
        return res.status(404).json({ error: "Timetable not found" })
      }
      return res.json({ success: true, id: req.params.id })
    } catch (err) {
      return next(err)
    }
  },
)

export default router
