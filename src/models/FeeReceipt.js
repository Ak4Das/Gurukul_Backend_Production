import mongoose from "mongoose"

const feeItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false },
)

const feeReceiptSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      required: true,
      unique: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
    },
    studentName: {
      type: String,
      required: true,
    },
    admissionNo: {
      type: String,
      required: true,
    },
    className: {
      type: String,
      default: "",
    },
    academicYear: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      required: true,
    },
    items: [feeItemSchema],
    subTotal: {
      type: Number,
      default: 0,
    },
    lateFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    amountDue: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    mode: {
      type: String,
      enum: ["cash", "card", "upi", "bank_transfer", "cheque", "other"],
      default: "cash",
    },
    remarks: {
      type: String,
      default: "",
    },
    collectedBy: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["paid", "refunded"],
      default: "paid",
    },
    refundedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

// feeReceiptSchema.index({ receiptNo: 1 });
feeReceiptSchema.index({ studentId: 1 })
feeReceiptSchema.index({ date: -1 })

export const FeeReceipt = mongoose.model(
  "FeeReceipt",
  feeReceiptSchema,
  "feeReceipts",
)
