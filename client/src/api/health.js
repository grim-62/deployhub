import { apiRequest } from './client.js'

export function fetchHealth() {
  return apiRequest('/health')
}