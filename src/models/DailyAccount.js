import mongoose from "mongoose"

const dailyAccountSchema = new mongoose.Schema(
  {
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    category: {
      type: String,
      enum: [
        "Fees",
        "Donation",
        "Utilities",
        "Supplies",
        "Maintenance",
        "Salary",
        "Transport",
        "Other",
      ],
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    receiptNumber: {
      type: String,
    },
    receiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeReceipt",
    },
    itemName: {
      type: String,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeReceipt",
    },
    assetName: {
      type: String,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeReceipt",
    },
    slipNumber: {
      type: String,
    },
    slipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeeReceipt",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    mode: {
      type: String,
      enum: ["cash", "online", "check", "upi", "card"],
      default: "cash",
    },
    recordedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
)

dailyAccountSchema.index({ date: 1 })
dailyAccountSchema.index({ type: 1 })
dailyAccountSchema.index({ date: -1 })

export const DailyAccount = mongoose.model(
  "DailyAccount",
  dailyAccountSchema,
  "dailyAccounts",
)
