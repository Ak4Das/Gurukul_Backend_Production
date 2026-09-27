import mongoose from "mongoose"

const substituteSchema = new mongoose.Schema(
  {
    absentTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Absent teacher ID is required"],
    },
    substituteTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Substitute teacher ID is required"],
    },
    date: {
      type: String,
      required: [true, "Date is required"],
    },
    periodId: {
      type: String,
      default: "",
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
    },
    status: {
      type: String,
      enum: ["allocated", "completed", "cancelled"],
      default: "allocated",
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

export const Substitute = mongoose.model(
  "Substitute",
  substituteSchema,
  "substitutes",
)
