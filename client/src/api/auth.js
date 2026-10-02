import { apiRequest, apiUrl } from './client.js'

export async function getCurrentUser() {
  const response = await apiRequest('/auth/me')
  return response.data.user
}

export function signInWithGitHub() {
  window.location.assign(apiUrl('/auth/github'))
}

export function endSession() {
  return apiRequest('/auth/logout', { method: 'POST' })
}