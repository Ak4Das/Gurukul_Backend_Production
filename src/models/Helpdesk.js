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
    },
    raisedBy: {
      type: String,
      required: [true, "Raised by is required"],
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["student", "parent", "teacher", "clerk", "supervisor", "admin"],
      required: [true, "Role is required"],
    },
    assignedTo: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

// Status-filtered newest-first tickets
helpdeskTicketSchema.index({ status: 1, createdAt: -1 })
// Category + status filtering
helpdeskTicketSchema.index({ category: 1, status: 1 })

export const Helpdesk = mongoose.model(
  "Helpdesk",
  helpdeskTicketSchema,
  "helpdesk",
)
