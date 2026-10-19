import jwt from "jsonwebtoken"
import dotenv from "dotenv"
dotenv.config()

export function authRequired(req, res, next) {
  const header = req.headers.authorization
  if (!header) {
    return res
      .status(401)
      .json({ error: "Access Denied: Missing authentication JWT token." })
  }
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null
  if (!token) {
    return res
      .status(401)
      .json({ error: "Access Denied: Token not present in header." })
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" })
    }
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "You do not have permission for this action" })
    }
    next()
  }
}

// Different set of roles
export const STAFF = ["admin", "clerk", "supervisor"]
export const STAFF_TEACHER = ["admin", "clerk", "supervisor", "teacher"]
export const ALL_ROLES = [
  "admin",
  "clerk",
  "supervisor",
  "teacher",
  "student",
  "parent",
]
