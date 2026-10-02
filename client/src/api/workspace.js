import { apiRequest } from './client.js'

export async function getProjects() {
  const response = await apiRequest('/projects')
  return response.data.projects
}

export async function getDeployments() {
  const response = await apiRequest('/deployments')
  return response.data.deployments
}

export async function getActivity() {
  const response = await apiRequest('/activity')
  return response.data.activity
}

export async function createProject(project) {
  const response = await apiRequest('/projects', { method: 'POST', body: project })
  return response.data.project
}

export async function getProject(projectId) {
  const response = await apiRequest(`/projects/${encodeURIComponent(projectId)}`)
  return response.data.project
}

export async function queueProjectDeployment(projectId) {
  const response = await apiRequest(`/projects/${encodeURIComponent(projectId)}/deploy`, { method: 'POST' })
  return response.data.deployment
}

export async function getDeployment(deploymentId) {
  const response = await apiRequest(`/deployments/${encodeURIComponent(deploymentId)}`)
  return response.data.deployment
}

export async function getDeploymentLogs(deploymentId) {
  const response = await apiRequest(`/deployments/${encodeURIComponent(deploymentId)}/logs`)
  return response.data.logs
}