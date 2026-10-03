import mongoose from "mongoose"

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    startDate: {
      type: String, // Stored as 'YYYY-MM-DD'
      required: [true, "Start date is required"],
    },
    endDate: {
      type: String,
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "published"],
      default: "scheduled",
    },
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    academicYear: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

examSchema.index({ startDate: -1 })
examSchema.index({ status: 1 })

export const Exam = mongoose.model("Exam", examSchema, "exams")
