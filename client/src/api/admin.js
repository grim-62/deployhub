import { apiRequest } from './client.js'

export async function getAdminLiveProjects() {
  const response = await apiRequest('/admin/projects/live')
  return response.data.projects
}

export async function getAdminProject(projectId) {
  const response = await apiRequest(`/admin/projects/${encodeURIComponent(projectId)}`)
  return response.data
}

export async function deleteAdminProject(projectId) {
  const response = await apiRequest(`/admin/projects/${encodeURIComponent(projectId)}`, { method: 'DELETE' })
  return response.data
}