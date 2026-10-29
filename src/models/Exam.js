import mongoose from "mongoose"

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["Quarterly", "Half Yearly", "Annual", "Mock Test"],
      required: true,
    },
    startDate: {
      type: String, // Stored as 'YYYY-MM-DD'
      required: [true, "Start date is required"],
    },
    endDate: {
      type: String,
      required: [true, "End date is required"],
    },
    status: {
      type: String,
      enum: ["scheduled", "ongoing", "completed", "published"],
      default: "scheduled",
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
