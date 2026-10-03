import mongoose from "mongoose"

const disciplineSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student reference is required"],
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Incident date is required"],
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
    incident: {
      type: String,
      default: "",
      trim: true,
    },
    actionTaken: {
      type: String,
      default: "",
      trim: true,
    },
    reportedBy: {
      type: String,
      default: "",
      trim: true,
    },
    reportedById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    parentNotified: {
      type: String,
      default: "no",
    },
    status: {
      type: String,
      enum: ["open", "in review", "closed"],
      default: "open",
      index: true,
    },
  },
  {
    timestamps: true,
  },
)

disciplineSchema.index({ studentId: 1, incidentDate: -1 })
disciplineSchema.index({ status: 1, incidentDate: -1 })

export const Discipline = mongoose.model(
  "Discipline",
  disciplineSchema,
  "disciplines",
)
