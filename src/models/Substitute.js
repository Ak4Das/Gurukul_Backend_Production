import mongoose from "mongoose"

const substitutePeriodSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
    },

    period: {
      type: Number,
      required: true,
      min: 1,
    },

    className: {
      type: String,
      required: true,
      trim: true,
    },

    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
)

const substituteSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    absentTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    absentTeacherName: {
      type: String,
      required: true,
      trim: true,
    },

    substituteTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    substituteTeacherName: {
      type: String,
      required: true,
      trim: true,
    },

    periods: {
      type: [substitutePeriodSchema],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: "At least one period is required",
      },
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["allocated", "completed", "cancelled"],
      default: "allocated",
      required: true,
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
