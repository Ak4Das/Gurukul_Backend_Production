import * as yup from "yup"

export const subjectUpdateSchema = yup
  .object({
    name: yup.string().strict().trim(),

    code: yup.string().strict().trim(),

    category: yup
      .string()
      .strict()
      .oneOf(
        ["Core", "Elective", "Vocational", "Extracurricular", "General"],
        "Invalid subject category",
      ),

    classIds: yup
      .array()
      .of(
        yup
          .string()
          .strict()
          .matches(/^[0-9a-fA-F]{24}$/, "One or more class IDs are invalid"),
      )
      .min(1, "At least one class is required"),

    maxMarks: yup
      .number()
      .strict()
      .typeError("Maximum marks must be a number")
      .moreThan(0, "Maximum marks must be a positive number"),

    passingMarks: yup
      .number()
      .strict()
      .typeError("Passing marks must be a number")
      .min(0, "Passing marks must be a non-negative number")
      .test(
        "passingMarks-not-greater-than-maxMarks",
        "Passing marks cannot exceed maximum marks",
        function (value) {
          const { maxMarks } = this.parent

          // If either field isn't supplied, the route will
          // compare against the existing database value.
          if (value === undefined || maxMarks === undefined) {
            return true
          }

          return value <= maxMarks
        },
      ),
  })
  .noUnknown("Unknown field is not allowed")
