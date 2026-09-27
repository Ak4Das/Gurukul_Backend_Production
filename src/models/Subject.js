import mongoose from "mongoose"

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
    },
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      enum: ["Core", "Elective", "Vocational", "Extracurricular", "General"],
      default: "Core",
    },
    type: {
      type: String,
      enum: ["Theory", "Practical", "Both"],
      default: "Theory",
    },
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
)

// subjectSchema.index({ name: 1 })
// subjectSchema.index({ code: 1 })

export const Subject = mongoose.model("Subject", subjectSchema, "subjects")
