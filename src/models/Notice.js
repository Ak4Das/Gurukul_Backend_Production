import mongoose from "mongoose"

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
    },
    audience: {
      type: String,
      enum: ["all", "students", "teachers", "parents", "staff"],
      default: "all",
    },
    postedBy: { type: String },
  },
  { timestamps: true },
)

noticeSchema.index({ status: 1, date: -1 })

export const Notice = mongoose.model("Notice", noticeSchema, "notices")
