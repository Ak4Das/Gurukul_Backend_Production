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
      trim: true,
      uppercase: true,
      required: true,
    },
    category: {
      type: String,
      enum: ["Core", "Elective", "Vocational", "Extracurricular", "General"],
      default: "Core",
    },
    classIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class",
        },
      ],
      required: true,
      validate: {
        validator: function (value) {
          return value.length >= 1
        },
        message: "At least one class is required",
      },
    },
    maxMarks: {
      type: Number,
      required: true,
    },
    passingMarks: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

export const Subject = mongoose.model("Subject", subjectSchema, "subjects")
