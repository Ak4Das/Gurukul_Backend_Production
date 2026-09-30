import mongoose from "mongoose"

const parentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Parent name is required"],
      trim: true,
    },
    relation: {
      type: String,
      default: "Guardian",
    },
    mobile: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    occupation: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
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

export const Parent = mongoose.model("Parent", parentSchema, "parents")
