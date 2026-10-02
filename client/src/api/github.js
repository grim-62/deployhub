import { apiRequest } from './client.js'

export async function getGitHubRepositories() {
  const response = await apiRequest('/github/repositories')
  return response.data.repositories
}

export async function getGitHubRepository(repositoryId) {
  const response = await apiRequest(`/github/repositories/${encodeURIComponent(repositoryId)}`)
  return response.data.repository
}