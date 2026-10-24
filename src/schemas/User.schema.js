import * as Yup from "yup"

export const userSchema = Yup.object({
  username: Yup.string().trim().required("Username is required"),

  password: Yup.string(),

  fullName: Yup.string().trim().required("Full name is required"),

  role: Yup.string()
    .oneOf(
      ["admin", "clerk", "teacher", "supervisor", "student", "parent"],
      "Invalid role",
    )
    .required("Role is required"),

  status: Yup.string()
    .oneOf(["active", "suspended", "inactive"], "Invalid status")
    .default("active"),

  email: Yup.string().trim().email("Invalid email address").default(""),

  mobile: Yup.string().trim().default(""),

  gender: Yup.string()
    .oneOf(["Male", "Female", "Other"], "Invalid gender")
    .default("Male"),

  dob: Yup.string(),

  address: Yup.string().default(""),

  qualification: Yup.string(),

  specialization: Yup.string(),

  joined: Yup.string(),

  refId: Yup.string().nullable().default(null),
})
