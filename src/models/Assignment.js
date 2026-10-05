import mongoose from "mongoose"

const teachersAssignmentsSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Teacher ID is required"],
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class ID is required"],
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject ID is required"],
    },
  },
  {
    timestamps: true,
  },
)

// Ensure a teacher is assigned to a specific class and subject combination only once
teachersAssignmentsSchema.index(
  { teacherId: 1, classId: 1, subjectId: 1 },
  { unique: true },
)

export const Assignment = mongoose.model(
  "Assignment",
  teachersAssignmentsSchema,
  "assignments",
)
