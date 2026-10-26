import mongoose from "mongoose"

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    room: {
      type: String,
      trim: true,
      maxlength: 50,
    },
  },
  { timestamps: true },
)

export const Class = mongoose.model("Class", classSchema, "classes")
