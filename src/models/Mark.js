import mongoose from "mongoose"

const markEntrySchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    marks: {
      type: Number,
      default: null,
    },
    grade: {
      type: String,
      default: "-",
    },
    pass: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
)

const markSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    entries: [markEntrySchema],
    status: {
      type: String,
      enum: ["draft", "submitted", "locked", "published"],
      default: "draft",
    },
    enteredBy: {
      type: String,
      default: "",
    },
    publishedBy: {
      type: String,
    },
    publishedAt: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

markSchema.index({ examId: 1, classId: 1, subjectId: 1 }, { unique: true })
markSchema.index({ examId: 1, status: 1 })

export const Mark = mongoose.model("Mark", markSchema, "marks")
