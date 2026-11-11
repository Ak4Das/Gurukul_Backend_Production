import * as Yup from "yup"

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return true
  }

  const [year, month, day] = value.split("-").map(Number)

  const parsedDate = new Date(year, month - 1, day)

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  )
}

const isNotFutureDate = (value) => {
  const today = new Date().toISOString().slice(0, 10)

  return value <= today
}

export const studentUpdateSchema = Yup.object({
  firstName: Yup.string()
    .trim()
    .required("First name is required")
    .min(2, "First name must contain at least 2 characters")
    .max(50, "First name cannot exceed 50 characters")
    .matches(/^[A-Z]/, "First name must start with an uppercase letter"),

  lastName: Yup.string()
    .trim()
    .default("")
    .test(
      "last-name-validation",
      "Last name must be empty or contain 2-50 characters and start with an uppercase letter",
      (value) => {
        if (value === undefined || value === "") {
          return true
        }

        return (
          typeof value === "string" &&
          value.length >= 2 &&
          value.length <= 50 &&
          /^[A-Z]/.test(value)
        )
      },
    ),

  gender: Yup.string()
    .oneOf(["Male", "Female", "Other"], "Invalid student gender")
    .required("Gender is required"),

  dob: Yup.string()
    .trim()
    .required("Date of birth is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must use YYYY-MM-DD format")
    .test(
      "valid-calendar-date",
      "Date of birth must be a valid calendar date",
      (value) => {
        if (!value) return true

        return isValidDate(value)
      },
    )
    .test("not-future", "Date of birth cannot be in the future", (value) => {
      if (!value) return true

      return isNotFutureDate(value)
    }),

  nationality: Yup.string()
    .trim()
    .required("Nationality is required")
    .matches(/^[A-Z]/, "Nationality must start with an uppercase letter"),

  curriculum: Yup.string()
    .oneOf(["CBSE"], "Invalid curriculum")
    .required("Curriculum is required"),

  allergies: Yup.string()
    .trim()
    .default("")
    .max(100, "Allergies cannot exceed 100 characters"),

  medicalNotes: Yup.string()
    .trim()
    .default("")
    .max(500, "Medical notes cannot exceed 500 characters"),

  languages: Yup.string()
    .trim()
    .required("Languages are required")
    .max(100, "Languages cannot exceed 100 characters")
    .matches(/^[A-Z]/, "Languages must start with an uppercase letter"),

  classId: Yup.string().required("Class ID is required"),

  admissionDate: Yup.string()
    .trim()
    .required("Admission date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Admission date must use YYYY-MM-DD format")
    .test(
      "valid-calendar-date",
      "Admission date must be a valid calendar date",
      (value) => {
        if (!value) return true

        return isValidDate(value)
      },
    )
    .test("not-future", "Admission date cannot be in the future", (value) => {
      if (!value) return true

      return isNotFutureDate(value)
    }),

  transportRequired: Yup.string()
    .oneOf(["yes", "no"], "Transport required must be yes or no")
    .required("Transport selection is required"),

  transportRoute: Yup.string()
    .trim()
    .default("")
    .max(100, "Transport route cannot exceed 100 characters")
    .when("transportRequired", {
      is: "yes",
      then: (schema) =>
        schema.required(
          "Transport route is required when transport is enabled",
        ),
      otherwise: (schema) => schema,
    }),

  academicYear: Yup.string()
    .trim()
    .required("Academic year is required")
    .matches(/^\d{4}-\d{4}$/, "Academic year must use YYYY-YYYY format")
    .test(
      "valid-academic-year",
      "The ending year must be one year after the starting year",
      (value) => {
        if (!value || !/^\d{4}-\d{4}$/.test(value)) {
          return true
        }

        const [startYear, endYear] = value.split("-").map(Number)

        return endYear === startYear + 1
      },
    ),

  status: Yup.string()
    .oneOf(
      ["active", "inactive", "transferred", "passed-out", "suspended"],
      "Invalid student status",
    )
    .required("Student status is required"),

  address: Yup.string()
    .trim()
    .required("Address is required")
    .max(300, "Address cannot exceed 300 characters"),
})
