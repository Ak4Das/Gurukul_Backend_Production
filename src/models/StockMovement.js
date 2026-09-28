import mongoose from "mongoose"

const stockMovementSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    itemName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["in", "issue", "adjust"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    issuedTo: {
      type: String,
      default: "",
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    by: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

stockMovementSchema.index({ itemId: 1, createdAt: -1 })

export const StockMovement = mongoose.model(
  "StockMovement",
  stockMovementSchema,
  "stockMovements",
)
