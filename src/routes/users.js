// essential imports
import { Router } from "express"
import mongoose from "mongoose"
// model imports
import { User } from "../models/User.js"
// middleware imports
import { authRequired, allowRoles, STAFF_TEACHER } from "../middleware/auth.js"
import { SchemaValidation } from "../middleware/SchemaValidation.js"
import { userSchema } from "../schemas/User.schema.js"
import bcrypt from "bcryptjs"

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
  SchemaValidation(userSchema),
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

      if (!username || !password || !fullName || !role) {
        return res.status(400).json({
          error: "Username, password, full name, and role are required",
        })
      }

      const normalizedUsername = username.toLowerCase().trim()
      const existingUser = await User.findOne({ username: normalizedUsername })

      if (existingUser) {
        return res
          .status(400)
          .json({ error: `Username "${normalizedUsername}" is already exist` })
      }

      // Pass password as passwordHash to trigger Mongoose pre-save hook
      const newUser = await User.create({
        username: normalizedUsername,
        passwordHash: String(password),
        fullName: fullName.trim(),
        role: role,
        email: email ? email.trim() : "",
        mobile: mobile ? mobile.trim() : "",
        gender: gender ? gender : "",
        status: status ? status : "active",
        dob: dob ? dob : "",
        qualification: qualification ? qualification : "",
        specialization: specialization ? specialization : "",
        address: address ? address : "",
        joined: joined ? joined : undefined,
      })

      return res.status(201).json(newUser)
    } catch (err) {
      return next(err)
    }
  },
)

//! PUT /users/:id - Update user details
router.put(
  "/:id",
  allowRoles("admin"),
  SchemaValidation(userSchema),
  async (req, res, next) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user ID format" })
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

      // Check duplicate username if username is changing
      if (username) {
        const normalizedUsername = username.toLowerCase().trim()
        if (normalizedUsername !== user.username) {
          const duplicateUser = await User.findOne({
            username: normalizedUsername,
          })
          if (duplicateUser) {
            return res.status(400).json({
              error: `Username "${normalizedUsername}" is already taken`,
            })
          }
          user.username = normalizedUsername
        }
      }

      if (fullName !== undefined) {
        user.fullName = fullName.trim()
      }
      if (email !== undefined) {
        user.email = email.trim()
      }
      if (mobile !== undefined) {
        user.mobile = mobile.trim()
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

      // Setting passwordHash triggers pre('save') hook on save()
      if (password) {
        user.passwordHash = String(password)
      }

      await user.save()
      return res.json(user)
    } catch (err) {
      return next(err)
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

//! POST /users/:id/status
router.post("/:id/status", allowRoles("admin"), async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const { status } = req.body
    if (!status) {
      return res.status(400).json({ error: "Status string is required" })
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { status: String(status) },
      { new: true, runValidators: true },
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
