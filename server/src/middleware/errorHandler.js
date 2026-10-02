import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { sendError } from '../utils/responses.js'

export function requireAuth(request, response, next) {
  if (!request.session?.userId) {
    return sendError(response, 401, 'UNAUTHORIZED', 'Authentication required')
  }
  return next()
}

export function notFound(request, response, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${request.method} ${request.originalUrl} was not found.`))
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error)
  const malformedJson = error.type === 'entity.parse.failed'
  const statusCode = malformedJson ? 400 : error instanceof AppError ? error.statusCode : 500
  const code = malformedJson ? 'INVALID_JSON' : error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR'
  const message = statusCode === 500 && env.nodeEnv === 'production'
    ? 'An unexpected error occurred.'
    : malformedJson ? 'Request body must contain valid JSON.' : error.message || 'An unexpected error occurred.'
  if (statusCode >= 500) console.error(error)
  return sendError(response, statusCode, code, message)
}