export function sendSuccess(response, data, statusCode = 200) {
  return response.status(statusCode).json({ success: true, data })
}

export function sendError(response, statusCode, code, message) {
  return response.status(statusCode).json({ success: false, error: { code, message } })
}