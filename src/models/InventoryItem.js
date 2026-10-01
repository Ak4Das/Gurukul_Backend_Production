import mongoose from "mongoose"

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    unit: {
      type: String,
      default: "pieces",
      trim: true,
    },
    reorderLevel: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      default: "active",
    },
  },
  {
    timestamps: true,
  },
)

inventoryItemSchema.index({ name: 1 })
inventoryItemSchema.index({ status: 1 })

export const InventoryItem = mongoose.model(
  "InventoryItem",
  inventoryItemSchema,
  "inventoryItems",
)
