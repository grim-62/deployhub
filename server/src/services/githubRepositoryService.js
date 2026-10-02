import { AppError } from '../utils/AppError.js'

export async function fetchGitHubRepositories(accessToken, fetchImpl = fetch) {
  const repositories = []
  let page = 1

  while (true) {
    const url = new URL('https://api.github.com/user/repos')
    url.searchParams.set('visibility', 'all')
    url.searchParams.set('affiliation', 'owner,collaborator,organization_member')
    url.searchParams.set('sort', 'updated')
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))

    let response
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'DeployHub',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(12000),
      })
    } catch {
      throw new AppError(502, 'GITHUB_REPOSITORIES_FAILED', 'GitHub repositories could not be reached.')
    }

    if (!response.ok) {
      throw new AppError(502, 'GITHUB_REPOSITORIES_FAILED', 'GitHub could not return your repositories. Reconnect GitHub and try again.')
    }

    let pageData
    try {
      pageData = await response.json()
    } catch {
      throw new AppError(502, 'GITHUB_REPOSITORIES_INVALID', 'GitHub returned invalid repository data.')
    }
    if (!Array.isArray(pageData)) {
      throw new AppError(502, 'GITHUB_REPOSITORIES_INVALID', 'GitHub returned invalid repository data.')
    }

    repositories.push(...pageData.map((repository) => ({
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description,
      private: repository.private,
      htmlUrl: repository.html_url,
      defaultBranch: repository.default_branch,
      language: repository.language,
      updatedAt: repository.updated_at,
      owner: {
        login: repository.owner?.login,
        avatarUrl: repository.owner?.avatar_url,
      },
    })))

    if (pageData.length < 100) return repositories
    page += 1
  }
}

export async function findGitHubRepositoryById(accessToken, repositoryId, fetchImpl = fetch) {
  const repositories = await fetchGitHubRepositories(accessToken, fetchImpl)
  const repository = repositories.find((item) => String(item.id) === String(repositoryId))
  if (!repository) {
    throw new AppError(404, 'GITHUB_REPOSITORY_NOT_FOUND', 'This repository is not available to your GitHub account.')
  }
  return repository
}