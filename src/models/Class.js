import mongoose from "mongoose"

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    academicYear: { type: String, required: true, trim: true },
    classTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true },
)

// Compound unique index for Class + Section + Academic Year
classSchema.index({ name: 1, section: 1, academicYear: 1 }, { unique: true })

export const Class = mongoose.model("Class", classSchema, "classes")
