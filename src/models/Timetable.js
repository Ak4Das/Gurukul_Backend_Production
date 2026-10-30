import mongoose from "mongoose"

const timetablePeriodSchema = new mongoose.Schema(
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

    start: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },

    end: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },

    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    subjectName: {
      type: String,
      required: true,
      trim: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    teacherName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
)

const timetableSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    periods: {
      type: [timetablePeriodSchema],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: "At least one timetable period is required",
      },
    },
  },
  {
    timestamps: true,
  },
)

export const Timetable = mongoose.model(
  "Timetable",
  timetableSchema,
  "timetables",
)
