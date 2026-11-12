import * as yup from "yup"

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

const PAYMENT_MODES = ["cash", "online", "check", "upi", "card"]

export const payrollUpdateSchema = yup
  .object({
    // Salary month: YYYY-MM
    month: yup
      .string()
      .strict()
      .typeError("Salary month must be a string")
      .matches(MONTH_REGEX, "Salary month must be in YYYY-MM format")
      .optional(),

    // Salary amount
    salary: yup
      .number()
      .strict()
      .typeError("Salary must be a number")
      .min(0, "Salary cannot be negative")
      .optional(),

    // Total working days
    workingDays: yup
      .number()
      .strict()
      .typeError("Working days must be a number")
      .integer("Working days must be an integer")
      .min(1, "Working days must be at least 1")
      .max(31, "Working days cannot exceed 31")
      .optional(),

    // Total present days
    presentDays: yup
      .number()
      .strict()
      .typeError("Present days must be a number")
      .integer("Present days must be an integer")
      .min(0, "Present days cannot be negative")
      .max(31, "Present days cannot exceed 31")
      .optional()
      .test(
        "present-days-within-working-days",
        "Present days cannot exceed working days",
        function (presentDays) {
          // The request may update presentDays without workingDays.
          // The route will compare it against the existing workingDays.
          if (
            presentDays === undefined ||
            this.parent.workingDays === undefined
          ) {
            return true
          }

          return presentDays <= this.parent.workingDays
        },
      ),

    // Payment mode
    mode: yup
      .string()
      .strict()
      .typeError("Payment mode must be a string")
      .oneOf(PAYMENT_MODES, "Invalid payment mode")
      .optional(),
  })
  .test(
    "at-least-one-field",
    "At least one field must be provided for update",
    (value) => {
      if (!value) return true

      return ["month", "salary", "workingDays", "presentDays", "mode"].some(
        (field) => value[field] !== undefined,
      )
    },
  )
  .test(
    "only-editable-fields",
    "Only month, salary, workingDays, presentDays, and mode can be updated",
    (value) => {
      if (!value) return true

      const allowedFields = [
        "month",
        "salary",
        "workingDays",
        "presentDays",
        "mode",
      ]

      return Object.keys(value).every((field) => allowedFields.includes(field))
    },
  )
