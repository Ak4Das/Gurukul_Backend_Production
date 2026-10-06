import mongoose from "mongoose"

const activitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Activity type is required"],
      trim: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
    },
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        required: [true, "Class Ids are required"], // each element of array must be ObjectId
      },
    ],
    inCharge: {
      type: String,
      required: [true, "In-charge name is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  },
)

activitySchema.index({ date: 1, status: 1 })
activitySchema.index({ classIds: 1 })

// First argument of mongoose.model ("Activity") is mongoose model name
// Third argument of mongoose.model ("activities") means store documents of this model inside activities collection in MongoDB
export const Activity = mongoose.model("Activity", activitySchema, "activities")
