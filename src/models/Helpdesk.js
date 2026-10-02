import mongoose from "mongoose"

const helpdeskTicketSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "Academic",
        "Fees & Finance",
        "Transport",
        "IT & Portal",
        "Hostel",
        "General Query",
        "Other",
      ],
      default: "General Query",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    raisedBy: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["student", "parent", "teacher", "staff", "admin"],
    },
    assignedTo: {
      type: String,
      trim: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

helpdeskTicketSchema.index({ status: 1, createdAt: -1 })
helpdeskTicketSchema.index({ category: 1, status: 1 })

export const Helpdesk = mongoose.model(
  "Helpdesk",
  helpdeskTicketSchema,
  "helpdesk",
)
