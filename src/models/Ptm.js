import mongoose from "mongoose"

const ptmSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    slots: { type: String, required: true, trim: true },
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
      },
    ],
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    notes: { type: String, required: true, trim: true },
  },
  { timestamps: true },
)

ptmSchema.index({ date: -1 })

export const Ptm = mongoose.model("Ptm", ptmSchema, "ptms")
