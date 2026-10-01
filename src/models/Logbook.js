import mongoose from "mongoose"

const logbookSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    teacherName: {
      type: String,
      required: [true, "Teacher name is required"],
      trim: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject ID is required"],
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
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

logbookSchema.index({ classId: 1, date: -1 })
logbookSchema.index({ teacherId: 1, date: -1 })

export const Logbook = mongoose.model("Logbook", logbookSchema, "logbook")
