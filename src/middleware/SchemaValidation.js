export const SchemaValidation = (schema) => async (req, res, next) => {
  try {
    const body = req.body
    await schema.validate(body)
    next()
  } catch (error) {
    next(error)
  }
}