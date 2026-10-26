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
      trim: true,
      required: [true, "Mobile number is required"],
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    occupation: {
      type: String,
      required: [true, "Parent occupation is required"],
    },
    address: {
      type: String,
      required: [true, "Parent address is required"],
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
