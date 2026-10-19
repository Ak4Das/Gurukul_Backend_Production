// Essential imports
import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()
import connectDB from "./db/db.js"
// Model imports
import { Settings } from "./models/Settings.js"
// Route imports
import activityRoutes from "./routes/activities.js"
import admissionsRoutes from "./routes/admissions.js"
import assetsRoutes from "./routes/assets.js"
import attendanceRoutes from "./routes/attendance.js"
import authRoutes from "./routes/auth.js"
import calendarRoutes from "./routes/calender.js"
import classesRoutes from "./routes/classes.js"
import complaintRoutes from "./routes/complaints.js"
import conductRoutes from "./routes/conduct.js"
import dailyAccountsRoutes from "./routes/dailyAccounts.js"
import dashboardRoutes from "./routes/dashboard.js"
import disciplineRoutes from "./routes/discipline.js"
import examsRoutes from "./routes/exams.js"
import feesRoutes from "./routes/fees.js"
import feeStructuresRoutes from "./routes/feeStructures.js"
import helpdeskRoutes from "./routes/helpdesk.js"
import inventoryRoutes from "./routes/inventory.js"
import logbookRoutes from "./routes/logbook.js"
import noticesRoutes from "./routes/notices.js"
import parentsRoutes from "./routes/parents.js"
import payrollRoutes from "./routes/payroll.js"
import portalRoutes from "./routes/portal.js"
import ptmRoutes from "./routes/ptm.js"
import settingRoutes from "./routes/settings.js"
import studentsRoutes from "./routes/students.js"
import subjectRoutes from "./routes/subjects.js"
import teachersRoutes from "./routes/teachers.js"
import timeTableRoutes from "./routes/timetables.js"
import usersRoutes from "./routes/users.js"

const app = express()

//! Global Middleware
app.use(
  cors({
    origin: "*",
    credentials: true,
    optionSuccessStatus: 200,
  }),
)
app.use(express.json())

//! Disable query buffering so queries fail fast if DB not connected yet or disconnects (prevents 10s hang)
/* default is mongoose.set("bufferCommands", true) means, 
User.find() (or any db query) -> MongoDB not connected -> Query stored temporarily (~10s) in queue -> MongoDB connect -> Execute query */
mongoose.set("bufferCommands", false)

//! API HEALTH ROUTE
app.get("/api/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1
  res.status(isDbConnected ? 200 : 503).json({
    ok: isDbConnected,
    dbStatus: isDbConnected ? "connected" : "disconnected",
    driver: "mongoose",
  })
})

//! Public branding for the login screen (no auth)
app.get("/api/public/settings", async (req, res, next) => {
  try {
    const doc = await Settings.findOne({ key: "school" }).lean()
    const v = doc?.value || {}
    return res.json({
      schoolName: v.schoolName || "Demo School",
      logoUrl: v.logoUrl || "",
      primaryColor: v.primaryColor || "#0f2248",
      accentColor: v.accentColor || "#16a34a",
    })
  } catch (err) {
    return next(err)
  }
})

//! API ROUTES
app.use("/api/activities", activityRoutes)
app.use("/api/admissions", admissionsRoutes)
app.use("/api/assets", assetsRoutes)
app.use("/api/attendance", attendanceRoutes)
app.use("/api/auth", authRoutes)
app.use("/api/calendar", calendarRoutes)
app.use("/api/classes", classesRoutes)
app.use("/api/complaints", complaintRoutes)
app.use("/api/conduct", conductRoutes)
app.use("/api/daily-accounts", dailyAccountsRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/discipline", disciplineRoutes)
app.use("/api/exams", examsRoutes)
app.use("/api/fees", feesRoutes)
app.use("/api/fee-structures", feeStructuresRoutes)
app.use("/api/helpdesk", helpdeskRoutes)
app.use("/api/inventory", inventoryRoutes)
app.use("/api/logbook", logbookRoutes)
app.use("/api/notices", noticesRoutes)
app.use("/api/parents", parentsRoutes)
app.use("/api/payroll", payrollRoutes)
app.use("/api/portal", portalRoutes)
app.use("/api/ptm", ptmRoutes)
app.use("/api/settings", settingRoutes)
app.use("/api/students", studentsRoutes)
app.use("/api/subjects", subjectRoutes)
app.use("/api/teachers", teachersRoutes)
app.use("/api/timetables", timeTableRoutes)
app.use("/api/users", usersRoutes)

//! GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: "Internal server error" })
})

//! SERVER INITIALIZATION
async function startServer() {
  try {
    // Establish database connection first
    await connectDB()

    // Start HTTP server only after DB connection succeeds
    app.listen(process.env.PORT, () => {
      console.log(`Server is running on http://localhost:${process.env.PORT}`)
    })
  } catch (err) {
    console.error("Failed to initialize database server:", err)
    process.exit(1)
  }
}

startServer()
