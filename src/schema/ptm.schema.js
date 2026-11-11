import * as Yup from "yup"

export const ptmCreateSchema = Yup.object({
  title: Yup.string().strict().trim().required("Title is required"),

  date: Yup.string()
    .strict()
    .required("Date is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .test("valid-calendar-date", "Invalid calendar date", (value) => {
      if (!value) return true

      const [year, month, day] = value.split("-").map(Number)

      const parsedDate = new Date(Date.UTC(year, month - 1, day))

      return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
      )
    })
    .test("not-past-date", "PTM date cannot be in the past", (value) => {
      if (!value) return true

      const today = new Date().toISOString().slice(0, 10)

      return value >= today
    }),

  slots: Yup.string().strict().trim().required("Slots are required"),

  classIds: Yup.array()
    .of(Yup.string().strict().required("Class ID is required"))
    .min(1, "At least one class is required")
    .required("Class IDs are required"),

  status: Yup.string()
    .strict()
    .oneOf(["scheduled", "completed", "cancelled"], "Invalid status")
    .required("Status is required"),

  notes: Yup.string().strict().trim().required("Notes are required"),
})
