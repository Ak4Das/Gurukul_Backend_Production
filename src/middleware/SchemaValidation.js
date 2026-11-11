export const SchemaValidation = (schema) => async (req, res, next) => {
  try {
    // abortEarly: false, means Don't stop on the first error collect all the validation errors
    // stripUnknown: true, means those properties which are not defined in the schema remove those properties from the validation result
    req.body = await schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    })
    next()
  } catch (error) {
    next(error)
  }
}
