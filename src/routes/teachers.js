// essential imports
import { Router } from "express"
// model imports
import { User } from "../models/User.js"
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"

const router = Router()

router.use(authRequired)

//! GET /teachers - List teacher users
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const teachers = await User.find({
      role: "teacher",
    }).sort({ fullName: 1 })

    const result = teachers.map((teacher) => teacher.toPublicJSON())

    return res.json(result)
  } catch (err) {
    return next(err)
  }
})

export default router
