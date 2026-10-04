import mongoose from "mongoose"

const conductSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student ID is required"],
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, "Date is required"],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"],
      index: true,
    },
    type: {
      type: String,
      enum: ["merit", "demerit"],
      default: "merit",
      trim: true,
    },
    note: {
      type: String,
      required: [true, "Note description is required"],
      trim: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    by: {
      type: String,
      required: [true, "Issuer name is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

conductSchema.index({ studentId: 1, date: -1 })
conductSchema.index({ type: 1, date: -1 })

export const Conduct = mongoose.model("Conduct", conductSchema, "conduct")
