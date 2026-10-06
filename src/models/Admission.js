import mongoose from "mongoose"

const admissionSchema = new mongoose.Schema(
  {
    regNo: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: [true, "Applicant first name is required"],
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
      required: [true, "Applicant gender is required"],
    },
    dob: {
      type: String,
      required: [true, "Applicant dob is required"],
    },
    classAppliedFor: {
      type: String,
      required: [true, "Class applied for is required"],
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
    },
    parentName: {
      type: String,
      default: "",
      trim: true,
    },
    parentRelation: {
      type: String,
      default: "Guardian",
    },
    parentMobile: {
      type: String,
      default: "",
      trim: true,
    },
    parentEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    parentOccupation: {
      type: String,
      default: "",
    },
    nationality: {
      type: String,
      default: "Indian",
    },
    curriculum: {
      type: String,
      enum: ["CBSE"],
      required: [true, "Curriculum is required"],
    },
    englishLevel: {
      type: String,
      default: "",
    },
    house: {
      type: String,
      default: "",
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
    address: {
      type: String,
      required: [true, "Address is required"],
    },
    status: {
      type: String,
      enum: ["registered", "admitted", "rejected", "pending"],
      default: "registered",
    },
    rejectReason: {
      type: String,
      default: "",
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },
    admissionNo: {
      type: String,
      default: "",
    },
    enrolledClassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
    },
  },
  {
    timestamps: true,
  },
)

// admissionSchema.index({ regNo: 1 });
admissionSchema.index({ status: 1 })

export const Admission = mongoose.model(
  "Admission",
  admissionSchema,
  "admissions",
)
