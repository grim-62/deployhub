import { AppError } from '../utils/AppError.js'

function mapGitHubRepository(repository) {
  return {
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
  }
}

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

    repositories.push(...pageData.map(mapGitHubRepository))

    if (pageData.length < 100) return repositories
    page += 1
  }
}

export async function findGitHubRepositoryById(accessToken, repositoryId, fetchImpl = fetch) {
  let response
  try {
    response = await fetchImpl(`https://api.github.com/repositories/${encodeURIComponent(repositoryId)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'DeployHub',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(12000),
    })
  } catch {
    throw new AppError(502, 'GITHUB_REPOSITORY_FAILED', 'GitHub repository details could not be reached.')
  }

  if (response.status === 404) {
    throw new AppError(404, 'GITHUB_REPOSITORY_NOT_FOUND', 'This repository is not available to your GitHub account.')
  }
  if (!response.ok) {
    throw new AppError(502, 'GITHUB_REPOSITORY_FAILED', 'GitHub could not return this repository.')
  }

  try {
    return mapGitHubRepository(await response.json())
  } catch {
    throw new AppError(502, 'GITHUB_REPOSITORY_INVALID', 'GitHub returned invalid repository data.')
  }
}

export function detectGitHubProjectStack(packageJson) {
  const dependencies = { ...packageJson?.devDependencies, ...packageJson?.dependencies }
  const has = (name) => Object.hasOwn(dependencies, name)

  if (has('next')) return { detected: true, framework: 'Next.js', projectType: 'frontend', runtime: 'node' }
  if (has('express')) return { detected: true, framework: 'Express', projectType: 'backend', runtime: 'node' }
  if (has('@nestjs/core')) return { detected: true, framework: 'NestJS', projectType: 'backend', runtime: 'node' }
  if (has('fastify')) return { detected: true, framework: 'Fastify', projectType: 'backend', runtime: 'node' }
  if (has('vite') && has('react')) return { detected: true, framework: 'React + Vite', projectType: 'frontend', runtime: 'static' }
  if (has('vite')) return { detected: true, framework: 'Vite', projectType: 'frontend', runtime: 'static' }
  if (has('react-scripts')) return { detected: true, framework: 'Create React App', projectType: 'frontend', runtime: 'static' }
  if (has('react')) return { detected: true, framework: 'React', projectType: 'frontend', runtime: 'static' }

  return { detected: false, framework: 'Unknown', projectType: null, runtime: null }
}

export async function analyzeGitHubRepositoryStack(accessToken, repositoryId, branch, fetchImpl = fetch) {
  const repository = await findGitHubRepositoryById(accessToken, repositoryId, fetchImpl)
  const [owner, name] = repository.fullName.split('/')
  const selectedBranch = branch || repository.defaultBranch || 'main'
  const repositoryPath = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
  const manifestUrl = new URL(`${repositoryPath}/contents/package.json`)
  manifestUrl.searchParams.set('ref', selectedBranch)
  const commitsUrl = new URL(`${repositoryPath}/commits`)
  commitsUrl.searchParams.set('sha', selectedBranch)
  commitsUrl.searchParams.set('per_page', '1')
  const requestOptions = {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'DeployHub',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(12000),
  }

  let manifestResponse
  let commitsResponse
  try {
    [manifestResponse, commitsResponse] = await Promise.all([
      fetchImpl(manifestUrl, requestOptions),
      Promise.resolve().then(() => fetchImpl(commitsUrl, requestOptions)).catch(() => null),
    ])
  } catch {
    throw new AppError(502, 'GITHUB_MANIFEST_FAILED', 'The repository manifest could not be reached.')
  }

  if (manifestResponse.status !== 404 && !manifestResponse.ok) {
    throw new AppError(502, 'GITHUB_MANIFEST_FAILED', 'GitHub could not return the repository manifest.')
  }

  let stack = detectGitHubProjectStack(null)
  try {
    if (manifestResponse.status !== 404) {
      const payload = await manifestResponse.json()
      if (payload.encoding === 'base64' && typeof payload.content === 'string' && payload.content.length <= 1_400_000) {
        stack = detectGitHubProjectStack(JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8')))
      }
    }
  } catch {
    stack = detectGitHubProjectStack(null)
  }

  let latestCommit = null
  if (commitsResponse?.ok) {
    try {
      const [commit] = await commitsResponse.json()
      if (commit?.sha) {
        latestCommit = {
          sha: commit.sha,
          url: commit.html_url || null,
          message: commit.commit?.message || '',
          author: commit.commit?.author?.name || commit.author?.login || 'Unknown author',
          authorLogin: commit.author?.login || null,
          date: commit.commit?.author?.date || null,
        }
      }
    } catch {
      latestCommit = null
    }
  }

  return { ...stack, branch: selectedBranch, latestCommit }
}