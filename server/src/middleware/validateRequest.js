import { AppError } from '../utils/AppError.js'

export function validateRequest(schemas) {
  return function validate(request, response, next) {
    request.validated ??= {}
    for (const [key, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(request[key])
      if (!result.success) {
        return next(new AppError(400, 'VALIDATION_ERROR', result.error.issues[0]?.message || `Invalid ${key}.`))
      }
      request.validated[key] = result.data
    }
    return next()
  }
}