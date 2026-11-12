import * as yup from "yup"

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

const PAYMENT_MODES = ["cash", "online", "check", "upi", "card"]

export const payrollCreateSchema = yup
  .object({
    // Staff ID
    staffId: yup
      .string()
      .strict()
      .typeError("Staff ID must be a string")
      .required("Staff member is required")
      .matches(OBJECT_ID_REGEX, "Invalid staff ID format"),

    // Salary month in YYYY-MM format
    month: yup
      .string()
      .strict()
      .typeError("Salary month must be a string")
      .required("Salary month is required")
      .matches(MONTH_REGEX, "Salary month must be in YYYY-MM format"),

    // Salary amount
    salary: yup
      .number()
      .strict()
      .typeError("Salary must be a number")
      .required("Salary is required")
      .min(0, "Salary cannot be negative"),

    // Total working days
    workingDays: yup
      .number()
      .strict()
      .typeError("Working days must be a number")
      .integer("Working days must be an integer")
      .min(1, "Working days must be at least 1")
      .max(31, "Working days cannot exceed 31")
      .notRequired(),

    // Total present days
    presentDays: yup
      .number()
      .strict()
      .typeError("Present days must be a number")
      .integer("Present days must be an integer")
      .min(0, "Present days cannot be negative")
      .max(31, "Present days cannot exceed 31")
      .notRequired()
      .test(
        "present-days-within-working-days",
        "Present days cannot exceed working days",
        function (presentDays) {
          // The field is optional; the route can apply its default.
          if (presentDays === undefined) {
            return true
          }

          const workingDays = this.parent.workingDays ?? 26

          return presentDays <= workingDays
        },
      ),

    // Payment mode
    mode: yup
      .string()
      .strict()
      .typeError("Payment mode must be a string")
      .oneOf(PAYMENT_MODES, "Invalid payment mode")
      .notRequired(),
  })
  .required("Request body is required")
