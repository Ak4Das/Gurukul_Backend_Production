import * as yup from "yup"

export const subjectCreateSchema = yup
  .object({
    name: yup.string().strict().trim().required("Subject name is required"),

    code: yup.string().strict().trim().required("Subject code is required"),

    category: yup
      .string()
      .strict()
      .oneOf(
        ["Core", "Elective", "Vocational", "Extracurricular", "General"],
        "Invalid subject category",
      )
      .notRequired(),

    classIds: yup
      .array()
      .of(
        yup
          .string()
          .strict()
          .matches(/^[0-9a-fA-F]{24}$/, "One or more class IDs are invalid"),
      )
      .min(1, "At least one class is required")
      .required("At least one class is required"),

    maxMarks: yup
      .number()
      .strict()
      .typeError("Maximum marks must be a number")
      .moreThan(0, "Maximum marks must be a positive number")
      .required("Maximum marks is required"),

    passingMarks: yup
      .number()
      .strict()
      .typeError("Passing marks must be a number")
      .moreThan(0, "Passing marks must be a positive number")
      .required("Passing marks is required")
      .test(
        "passingMarks-not-greater-than-maxMarks",
        "Passing marks cannot exceed maximum marks",
        function (value) {
          const { maxMarks } = this.parent

          if (value === undefined || maxMarks === undefined) {
            return true
          }

          return value <= maxMarks
        },
      ),
  })
  .noUnknown("Unknown field is not allowed")
