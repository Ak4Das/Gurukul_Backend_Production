import mongoose from "mongoose"

const attendanceRecordSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "halfday", "leave"],
      required: true,
    },
    remarks: { type: String, default: "" },
  },
  { _id: false },
)

const attendanceSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    date: { type: String, required: true }, // 'YYYY-MM-DD'
    records: [attendanceRecordSchema],
    takenBy: { type: String },
  },
  { timestamps: true },
)

attendanceSchema.index({ classId: 1, date: 1 }, { unique: true })

export const Attendance = mongoose.model(
  "Attendance",
  attendanceSchema,
  "attendances",
)
