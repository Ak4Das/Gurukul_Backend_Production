import mongoose from "mongoose"

const allowanceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
)

const deductionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
)

const salarySlipSchema = new mongoose.Schema(
  {
    slipNo: {
      type: String,
      required: true,
      unique: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    staffName: { type: String, required: true },
    role: { type: String },
    designation: { type: String },
    month: { type: String, required: true }, // Format: 'YYYY-MM'
    basicSalary: { type: Number, default: 0 },
    allowances: [allowanceSchema],
    deductions: [deductionSchema],
    gross: { type: Number, default: 0 },
    totalAllowances: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    workingDays: { type: Number, default: 26 },
    presentDays: { type: Number, default: 26 },
    status: {
      type: String,
      enum: ["generated", "paid", "cancelled"],
      default: "generated",
    },
    generatedBy: { type: String, required: true },
    paidOn: { type: String }, // Format: 'YYYY-MM-DD'
    mode: { type: String },
    paidBy: { type: String },
  },
  {
    timestamps: true,
  },
)

salarySlipSchema.index({ staffId: 1, month: 1 }, { unique: true })
salarySlipSchema.index({ month: 1, status: 1 })

export const SalarySlip = mongoose.model(
  "SalarySlip",
  salarySlipSchema,
  "salarySlips",
)
