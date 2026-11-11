import * as Yup from "yup"

export const ptmUpdateSchema = Yup.object({
  title: Yup.string().strict().trim().notRequired(),

  date: Yup.string()
    .strict()
    .matches(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .test("valid-calendar-date", "Invalid calendar date", (value) => {
      if (value === undefined) return true

      const [year, month, day] = value.split("-").map(Number)

      const parsedDate = new Date(Date.UTC(year, month - 1, day))

      return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day
      )
    })
    .test("not-past-date", "PTM date cannot be in the past", (value) => {
      if (value === undefined) return true

      const today = new Date().toISOString().slice(0, 10)

      return value >= today
    })
    .notRequired(),

  slots: Yup.string().strict().trim().notRequired(),

  classIds: Yup.array()
    .of(
      Yup.string()
        .strict()
        .required("Class ID is required")
        .test(
          "valid-object-id",
          "Invalid class ID",
          (value) => !value || mongoose.Types.ObjectId.isValid(value),
        ),
    )
    .min(1, "At least one class is required")
    .notRequired(),

  status: Yup.string()
    .strict()
    .oneOf(["scheduled", "completed", "cancelled"], "Invalid status")
    .notRequired(),

  notes: Yup.string().strict().trim().notRequired(),
})
