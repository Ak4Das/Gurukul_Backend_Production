// essential Imports
import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()
// model imports
import { User } from "../models/User.js"
// middleware imports
import { authRequired } from "../middleware/auth.js"

const router = Router()

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

//! POST /auth/login - User login
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" })
    }

    const user = await User.findOne({
      username: String(username).toLowerCase(), // Since username is always in lowercase in DB
    })
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" })
    }

    if (user.status === "suspended") {
      return res
        .status(403)
        .json({ error: "Account suspended. Contact administrator." })
    }

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid username or password" })
    }

    user.lastLogin = new Date().toISOString()
    await user.save()

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.fullName,
        refId: user.refId || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    )

    return res.json({ token, user: user.toPublicJSON() })
  } catch (err) {
    return next(err)
  }
})

//! GET /auth/me - Get current logged-in user profile
router.get("/me", authRequired, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.json(user.toPublicJSON())
  } catch (err) {
    return next(err)
  }
})

//! PUT /auth/me - Update user profile
router.put("/me", authRequired, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const { fullName, email, mobile, gender, address, avatarColor } = req.body

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { fullName, email, mobile, gender, address, avatarColor },
      { new: true, runValidators: true },
    )

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    return res.json(user.toPublicJSON())
  } catch (err) {
    return next(err)
  }
})

//! POST /auth/change-password - Change account password
router.post("/change-password", authRequired, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ error: "Invalid user ID format" })
    }

    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const isPasswordValid = await user.comparePassword(currentPassword || "")
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" })
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" })
    }

    const salt = await bcrypt.genSalt(10)
    user.passwordHash = await bcrypt.hash(newPassword, salt)
    await user.save()

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

export default router
