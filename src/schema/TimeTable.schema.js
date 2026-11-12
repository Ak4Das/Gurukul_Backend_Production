import * as yup from "yup"

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

const timetablePeriodSchema = yup
  .object({
    day: yup
      .string()
      .strict()
      .required("Day is required")
      .oneOf(VALID_DAYS, "Invalid day"),

    period: yup
      .number()
      .strict()
      .typeError("Period must be a number")
      .integer("Period must be an integer")
      .min(1, "Period must be between 1 and 5")
      .max(7, "Period must be between 1 and 5")
      .required("Period is required"),

    start: yup
      .string()
      .strict()
      .required("Start time is required")
      .matches(TIME_REGEX, "Start time must be in HH:mm format"),

    end: yup
      .string()
      .strict()
      .required("End time is required")
      .matches(TIME_REGEX, "End time must be in HH:mm format"),

    subjectId: yup.string().strict().required("subjectId is required"),

    teacherId: yup.string().strict().required("teacherId is required"),
  })
  .test(
    "duration",
    "Start time must be exactly 45 minutes before end time",
    function (period) {
      if (!period?.start || !period?.end) {
        return true
      }

      // Format validation is handled by matches().
      // Don't perform time calculation if either value is invalid.
      if (!TIME_REGEX.test(period.start) || !TIME_REGEX.test(period.end)) {
        return true
      }

      const startMinutes = timeToMinutes(period.start)
      const endMinutes = timeToMinutes(period.end)

      if (endMinutes - startMinutes !== 45) {
        return this.createError({
          path: `${this.path}.end`,
          message: "End time must be exactly 45 minutes after start time",
        })
      }

      return true
    },
  )

export const timetableCreateUpdateSchema = yup.object({
  timetableId: yup
    .string()
    .strict()
    .matches(/^[0-9a-fA-F]{24}$/, "Invalid timetable ID")
    .notRequired(),

  periods: yup
    .array()
    .required("Periods are required")
    .min(1, "At least one timetable period is required")
    .of(timetablePeriodSchema),
})
