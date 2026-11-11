// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { User } from "../models/User.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"
import bcrypt from "bcryptjs"
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { userCreateSchema } from "../schema/UserCreate.schema.js"
import { userPatchSchema } from "../schema/UserUpdate.schema.js"

const router = Router()

// Apply auth middleware on each routes created using router
router.use(authRequired)

// Helper function to check valid Mongoose ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! GET /users - List users
router.get("/", allowRoles(...STAFF_TEACHER), async (req, res, next) => {
  try {
    const query = {}

    if (req.query.role) {
      const roles = Array.isArray(req.query.role)
        ? req.query.role
        : [req.query.role]

      query.role = { $in: roles }
    }

    if (req.query.status) {
      query.status = String(req.query.status)
    }

    const users = await User.find(query).sort({ createdAt: -1 })
    return res.json(users)
  } catch (err) {
    return next(err)
  }
})

//! POST /users - Create new user
router.post(
  "/",
  allowRoles("admin"),
  SchemaValidation(userCreateSchema),
  async (req, res, next) => {
    try {
      const {
        username,
        password,
        fullName,
        role,
        email,
        mobile,
        gender,
        status,
        dob,
        qualification,
        specialization,
        address,
        joined,
      } = req.body

      if (!username || !password || !fullName || !role || !status || !gender) {
        return res.status(400).json({
          error:
            "Username, password, full name, role, status, gender are required",
        })
      }

      const normalizedUsername = username.toLowerCase().trim()
      const normalizedEmail = email ? email.toLowerCase().trim() : ""
      const normalizedMobile = mobile ? mobile.trim() : ""

      // Base user data
      const userData = {
        username: normalizedUsername,
        passwordHash: String(password),
        fullName: fullName.trim(),
        role,
        gender,
        status,
        dob: dob ? dob : "",
        address: address ? address : "",
        ...(qualification ? { qualification: qualification.trim() } : {}),
        ...(specialization ? { specialization: specialization.trim() } : {}),
        ...(joined ? { joined } : {}),
      }

      // Email and mobile are NOT stored for student users
      if (role !== "student") {
        if (normalizedEmail) {
          userData.email = normalizedEmail
        }

        if (normalizedMobile) {
          userData.mobile = normalizedMobile
        }
      }

      const newUser = await User.create(userData)

      return res.status(201).json(newUser.toPublicJSON())
    } catch (error) {
      if (error?.code === 11000) {
        const field = Object.keys(error.keyPattern || error.keyValue || {})[0]
        return res.status(400).json({
          error: field ? `${field} must be unique` : "Duplicate record",
        })
      }

      if (error?.name === "ValidationError" || error?.name === "CastError") {
        return res.status(400).json({ error: error.message })
      }

      return next(error)
    }
  },
)

//! PATCH /users/:id - Update user details
router.patch(
  "/:id",
  allowRoles("admin"),
  SchemaValidation(userPatchSchema),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user ID format" })
      }

      // Reject an empty update request.
      if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
          error: "At least one field is required to update the user",
        })
      }

      const user = await User.findById(req.params.id)

      if (!user) {
        return res.status(404).json({ error: "User not found" })
      }

      const {
        username,
        password,
        fullName,
        email,
        mobile,
        gender,
        role,
        status,
        dob,
        qualification,
        specialization,
        address,
        joined,
      } = req.body

      // Determine the role after this update
      const finalRole = role !== undefined ? role : user.role

      if (finalRole === "student") {
        delete user.email
        delete user.mobile
      } else {
        if (email !== undefined) {
          user.email = email.toLowerCase().trim()
        }

        if (mobile !== undefined) {
          user.mobile = mobile.trim()
        }
      }

      if (fullName !== undefined) {
        user.fullName = fullName.trim()
      }

      if (username !== undefined) {
        user.username = username.toLowerCase().trim()
      }

      if (gender !== undefined) {
        user.gender = gender
      }

      if (role !== undefined) {
        user.role = role
      }

      if (status !== undefined) {
        user.status = status
      }

      if (dob !== undefined) {
        user.dob = dob
      }

      if (qualification !== undefined) {
        user.qualification = qualification
      }

      if (specialization !== undefined) {
        user.specialization = specialization
      }

      if (address !== undefined) {
        user.address = address
      }

      if (joined !== undefined) {
        user.joined = joined
      }

      // Setting passwordHash triggers pre('save') hook
      if (password) {
        user.passwordHash = String(password)
      }

      await user.save()

      return res.json(user.toPublicJSON())
    } catch (error) {
      if (error?.code === 11000) {
        const field = Object.keys(error.keyPattern || error.keyValue || {})[0]
        return res.status(400).json({
          error: field ? `${field} must be unique` : "Duplicate record",
        })
      }

      if (error?.name === "ValidationError" || error?.name === "CastError") {
        return res.status(400).json({ error: error.message })
      }

      return next(error)
    }
  },
)

//! POST /users/:id/reset-password
router.post(
  "/:id/reset-password",
  allowRoles(...STAFF_TEACHER),
  async (req, res, next) => {
    try {
      const { id } = req.params
      const { oldPassword, newPassword } = req.body

      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: "Invalid user ID format" })
      }

      if (!oldPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Old password and new password are required" })
      }

      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: "New password must be at least 6 characters long" })
      }

      if (oldPassword === newPassword) {
        return res
          .status(400)
          .json({ error: "New password must be different from old password" })
      }

      const user = await User.findById(id)

      if (!user) {
        return res.status(404).json({ error: "User not found" })
      }

      const matchesCurrent = await bcrypt.compare(
        oldPassword,
        user.passwordHash,
      )

      if (!matchesCurrent) {
        return res.status(400).json({
          error: "Incorrect old password",
        })
      }

      user.passwordHash = String(newPassword)
      await user.save()

      return res.json({
        ok: true,
        message: "Password has been reset successfully",
      })
    } catch (err) {
      return next(err)
    }
  },
)

//! PATCH /users/:id/status
router.patch("/:id/status", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const validStatuses = ["active", "suspended", "inactive"]

    const { status } = req.body
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Valid status string is required" })
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { status: String(status) },
      { returnDocument: "after", runValidators: true },
    )

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.json(updatedUser)
  } catch (err) {
    return next(err)
  }
})

//! DELETE /users/:id - Delete account
router.delete("/:id", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const currentUserId = String(req.user?.id)
    if (req.params.id === currentUserId) {
      return res
        .status(400)
        .json({ error: "You cannot delete your own account" })
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id)
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.json({ ok: true, message: "User deleted successfully" })
  } catch (err) {
    return next(err)
  }
})

export default router
