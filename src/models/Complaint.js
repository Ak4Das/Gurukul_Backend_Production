import mongoose from "mongoose"

const complaintSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Complaint subject is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Complaint details are required"],
      trim: true,
    },
    against: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
    },
    raisedBy: {
      type: String,
      trim: true,
      required: true,
    },
    role: {
      type: String,
      enum: ["student", "parent", "teacher", "staff", "admin"],
      required: true,
    },
    resolution: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

export const Complaint = mongoose.model(
  "Complaint",
  complaintSchema,
  "complaints",
)
