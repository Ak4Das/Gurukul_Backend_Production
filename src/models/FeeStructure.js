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
      enum: ["tuition", "transport", "exam", "admission", "other"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
    },
    frequency: {
      type: String,
      enum: ["monthly", "annually"],
      default: "monthly",
    },
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
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
