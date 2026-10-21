import * as Yup from "yup"

export const userSchema = Yup.object({
  username: Yup.string().trim().lowercase(),

  passwordHash: Yup.string(),

  fullName: Yup.string().trim(),

  role: Yup.string().oneOf(
    ["admin", "staff", "teacher", "student", "parent"],
    "Invalid role",
  ),

  status: Yup.string()
    .oneOf(["active", "suspended", "inactive"], "Invalid status")
    .default("active"),

  email: Yup.string().email("Invalid email").trim().lowercase().default(""),

  mobile: Yup.string().trim().default(""),

  gender: Yup.string().default(""),

  dob: Yup.string(),

  address: Yup.string().default(""),

  qualification: Yup.string(),

  specialization: Yup.string(),

  joined: Yup.string(),

  avatarColor: Yup.string().default(""),

  refId: Yup.string()
    .nullable()
    .default(null)
    .test(
      "objectId",
      "Invalid ObjectId",
      (value) => !value || /^[0-9a-fA-F]{24}$/.test(value),
    ),

  lastLogin: Yup.string().nullable().default(null),
})
