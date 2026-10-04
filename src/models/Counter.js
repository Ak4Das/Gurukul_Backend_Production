import mongoose from "mongoose"

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const Counter = mongoose.model("Counter", counterSchema, "counters")

// Atomically increments and fetches the next sequence value.
export async function nextSeq(sequenceName) {
  const counter = await Counter.findOneAndUpdate(
    { key: sequenceName },
    { $inc: { value: 1 } }, // increment seq by 1
    { new: true, upsert: true }, // upsert: true means update if the document exists; otherwise create it.
  )
  return counter.value
}
