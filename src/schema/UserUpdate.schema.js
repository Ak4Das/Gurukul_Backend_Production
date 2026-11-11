import * as Yup from "yup"

export const userPatchSchema = Yup.object({
  username: Yup.string()
    .trim()
    .min(1, "Username cannot be empty")
    .notRequired(),

  password: Yup.string()
    .test(
      "password-min-length",
      "Password must be at least 6 characters long",
      (value) => !value || value.length >= 6,
    )
    .notRequired(),

  fullName: Yup.string()
    .trim()
    .min(1, "Full name cannot be empty")
    .matches(/^[A-Z]/, "First letter must be capital")
    .notRequired(),

  email: Yup.string().trim().email("Invalid email address").notRequired(),

  mobile: Yup.string()
    .trim()
    .matches(/^\+[1-9]\d{0,2} \d{5} \d{5}$/, {
      message:
        "Mobile number must be '+<country code> <Five digit> <Remaining Five digits>' format",
      excludeEmptyString: true,
    })
    .notRequired(),

  gender: Yup.string()
    .oneOf(["Male", "Female", "Other"], "Invalid gender")
    .notRequired(),

  role: Yup.string()
    .oneOf(
      ["admin", "clerk", "teacher", "supervisor", "student", "parent"],
      "Invalid role",
    )
    .notRequired(),

  status: Yup.string()
    .oneOf(["active", "suspended", "inactive"], "Invalid status")
    .notRequired(),

  dob: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Date of birth must be in YYYY-MM-DD format",
      excludeEmptyString: true,
    })
    .notRequired(),

  qualification: Yup.string().notRequired(),

  specialization: Yup.string().notRequired(),

  address: Yup.string().notRequired(),

  joined: Yup.string().notRequired(),
})
