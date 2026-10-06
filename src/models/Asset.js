import mongoose from "mongoose"

const maintenanceSchema = new mongoose.Schema(
  {
    date: {
      type: String, // Stored as 'YYYY-MM-DD'
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    cost: {
      type: Number,
      default: 0,
    },
    by: {
      type: String,
      default: "",
    },
  },
  { _id: false },
)

const assetSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Asset name is required"],
      trim: true,
    },
    category: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["in-use", "in-repair", "decommissioned", "available"],
      default: "in-use",
    },
    location: {
      type: String,
      default: "",
    },
    purchaseDate: {
      type: String,
      default: "",
    },
    cost: {
      type: Number,
      default: 0,
    },
    maintenance: [maintenanceSchema],
  },
  {
    timestamps: true,
  },
)

// assetSchema.index({ tag: 1 });
assetSchema.index({ status: 1 })
assetSchema.index({ category: 1 })
assetSchema.index({ name: "text", tag: "text" })

export const Asset = mongoose.model("Asset", assetSchema, "assets")
