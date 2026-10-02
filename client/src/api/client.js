const apiRoot = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function apiUrl(path) {
  return `${apiRoot}/${String(path).replace(/^\/+/, '')}`
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, ...requestOptions } = options
  const response = await fetch(apiUrl(path), {
    ...requestOptions,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code || 'REQUEST_FAILED',
      payload?.error?.message || 'The request could not be completed.',
    )
  }
  return payload
}