import { apiRequest } from './client.js'

export async function getGitHubRepositories() {
  const response = await apiRequest('/github/repositories')
  return response.data.repositories
}

export async function getGitHubRepository(repositoryId) {
  const response = await apiRequest(`/github/repositories/${encodeURIComponent(repositoryId)}`)
  return response.data.repository
}

export async function analyzeGitHubRepositoryStack(repositoryId, branch) {
  const query = new URLSearchParams()
  if (branch) query.set('branch', branch)
  const response = await apiRequest(`/github/repositories/${encodeURIComponent(repositoryId)}/stack?${query}`)
  return response.data.stack
}