import mongoose from "mongoose"

const feeStructureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Fee structure name is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "tuition",
        "transport",
        "exam",
        "admission",
        "lab",
        "activity",
        "other",
      ],
      required: true,
    },
    frequency: {
      type: String,
      enum: ["monthly", "annually"],
      default: "monthly",
    },
    classIds: {
      type: [
        {
          classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
            required: true,
          },
          amount: {
            type: Number,
            required: true,
          },
        },
      ],
      validate: {
        validator: (value) => value.length > 0,
        message: "At least one class is required",
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
)

export const FeeStructure = mongoose.model(
  "FeeStructure",
  feeStructureSchema,
  "feeStructures",
)
