import mongoose from "mongoose"

const studentSchema = new mongoose.Schema(
  {
    admissionNo: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      default: "",
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },
    dob: {
      type: String,
      required: true,
    },
    nationality: {
      type: String,
      default: "Indian",
    },
    curriculum: {
      type: String,
      enum: ["CBSE"],
      required: true,
    },
    allergies: {
      type: String,
      default: "",
    },
    medicalNotes: {
      type: String,
      default: "",
    },
    languages: {
      type: String,
      default: "",
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
    },
    rollNo: {
      type: String,
      required: true,
    },
    admissionDate: {
      type: String,
      required: true,
    },
    transportRequired: {
      type: String,
      default: "no",
    },
    transportRoute: {
      type: String,
      default: "",
    },
    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Parent",
      },
    ],
    academicYear: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "transferred", "passed-out", "suspended"],
      default: "active",
    },
    address: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

// Class-wise student queries are important
studentSchema.index({ classId: 1 })

// Efficient parent to students lookup
studentSchema.index({ parentIds: 1 })

// Student list filtering
studentSchema.index({ status: 1 })

// Class + status filtering
studentSchema.index({
  classId: 1,
  status: 1,
})

export const Student = mongoose.model("Student", studentSchema, "students")
