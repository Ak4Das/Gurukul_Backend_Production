import mongoose from "mongoose"

const logbookSchema = new mongoose.Schema(
  {
    teacherName: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject ID is required"],
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    topicCovered: {
      type: String,
      required: [true, "Topic covered is required"],
      trim: true,
    },
    homeworkGiven: {
      type: String,
      default: "",
      trim: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  },
)

// Class-wise chronological logbook
logbookSchema.index({ classId: 1, date: -1 })

export const Logbook = mongoose.model("Logbook", logbookSchema, "logbook")
