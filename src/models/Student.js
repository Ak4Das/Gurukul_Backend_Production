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
      default:"",
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

// studentSchema.index({ admissionNo: 1 });
studentSchema.index({ classId: 1 })
studentSchema.index({ parentIds: 1 })

export const Student = mongoose.model("Student", studentSchema, "students")
