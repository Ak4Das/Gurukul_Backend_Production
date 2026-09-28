import mongoose from "mongoose"

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // e.g., 'school'
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const Settings = mongoose.model("Setting", settingSchema, "settings")
