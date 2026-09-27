import mongoose from "mongoose"

const periodSchema = new mongoose.Schema({
  day: { type: String, required: true }, // e.g., 'Monday'
  periodNo: { type: Number, required: true },
  subject: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  startTime: { type: String }, // '09:00'
  endTime: { type: String }, // '09:45'
})

const timetableSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      unique: true,
    },
    periods: [periodSchema],
  },
  { timestamps: true },
)

export const Timetable = mongoose.model(
  "Timetable",
  timetableSchema,
  "timetables",
)
