import * as Yup from "yup"

export const userCreateSchema = Yup.object({
  username: Yup.string().trim().required("Username is required"),

  password: Yup.string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters long"),

  fullName: Yup.string()
    .trim()
    .matches(/^[A-Z]/, "First letter must be capital")
    .required("Full name is required"),

  role: Yup.string()
    .oneOf(
      ["admin", "clerk", "supervisor", "teacher", "student", "parent"],
      "Invalid role",
    )
    .required("Role is required"),

  status: Yup.string()
    .oneOf(["active", "suspended", "inactive"], "Invalid status")
    .required("Status is required"),

  gender: Yup.string()
    .oneOf(["Male", "Female", "Other"], "Invalid gender")
    .required("Gender is required"),

  email: Yup.string()
    .trim()
    .email("Invalid email address")
    .when("role", {
      is: (role) => ["admin", "clerk", "supervisor", "teacher"].includes(role),

      then: (schema) =>
        schema.required(
          "Email is required for admin, clerk, supervisor, and teacher roles",
        ),

      otherwise: (schema) => schema.notRequired(),
    }),

  mobile: Yup.string()
    .trim()
    .matches(/^\+[1-9]\d{0,2} \d{5} \d{5}$/, {
      message:
        "Mobile number must be '+<country code> <Five digit> <Remaining Five digits>' format",
      excludeEmptyString: true,
    })
    .when("role", {
      is: (role) =>
        ["admin", "clerk", "supervisor", "teacher", "parent"].includes(role),

      then: (schema) =>
        schema.required(
          "Mobile number is required for admin, clerk, supervisor, teacher, and parent roles",
        ),

      otherwise: (schema) => schema.notRequired(),
    }),

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
