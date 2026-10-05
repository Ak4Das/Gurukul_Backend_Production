import mongoose from "mongoose"

const calendarEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["holiday", "event", "exam", "meeting", "other"],
      default: "event",
      lowercase: true,
      trim: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  },
)

calendarEventSchema.index({ type: 1, date: 1 })

export const Calendar = mongoose.model(
  "CalendarEvent",
  calendarEventSchema,
  "calendarEvents",
)
