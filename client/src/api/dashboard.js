import { apiRequest } from './client.js'

export async function getDashboard() {
  const response = await apiRequest('/dashboard')
  return response.data
}