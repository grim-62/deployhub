import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeGitHubRepositoryStack, detectGitHubProjectStack, fetchGitHubRepositories, findGitHubRepositoryById } from '../src/services/githubRepositoryService.js'

test('detects common project stacks and service types from package manifests', () => {
  assert.deepEqual(detectGitHubProjectStack({ dependencies: { next: '15.0.0', react: '19.0.0' } }), {
    detected: true,
    framework: 'Next.js',
    projectType: 'frontend',
    runtime: 'node',
  })
  assert.deepEqual(detectGitHubProjectStack({ devDependencies: { vite: '6.0.0' }, dependencies: { react: '19.0.0' } }), {
    detected: true,
    framework: 'React + Vite',
    projectType: 'frontend',
    runtime: 'static',
  })
  assert.deepEqual(detectGitHubProjectStack({ dependencies: { express: '5.0.0' } }), {
    detected: true,
    framework: 'Express',
    projectType: 'backend',
    runtime: 'node',
  })
  assert.equal(detectGitHubProjectStack({}).detected, false)
})

test('analyzes the selected branch package manifest without returning its contents', async () => {
  const requests = []
  const fetchImpl = async (url, options) => {
    const requestUrl = new URL(url)
    requests.push({ url: requestUrl, options })
    if (requestUrl.pathname === '/repositories/42') {
      return {
        ok: true,
        json: async () => ({
          id: 42,
          name: 'deployhub-demo',
          full_name: 'octocat/deployhub-demo',
          default_branch: 'main',
        }),
      }
    }
    if (requestUrl.pathname.endsWith('/commits')) {
      return {
        ok: true,
        json: async () => [{
          sha: 'abcdef1234567890',
          html_url: 'https://github.com/octocat/deployhub-demo/commit/abcdef1234567890',
          commit: { message: 'Add API routes', author: { name: 'Octocat', date: '2026-10-03T10:00:00Z' } },
          author: { login: 'octocat' },
        }],
      }
    }
    return {
      ok: true,
      json: async () => ({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify({ dependencies: { express: '5.0.0' } })).toString('base64'),
      }),
    }
  }

  const stack = await analyzeGitHubRepositoryStack('test-token', 42, 'feature/api', fetchImpl)

  assert.equal(stack.framework, 'Express')
  assert.equal(stack.projectType, 'backend')
  assert.equal(stack.branch, 'feature/api')
  assert.deepEqual(stack.latestCommit, {
    sha: 'abcdef1234567890',
    url: 'https://github.com/octocat/deployhub-demo/commit/abcdef1234567890',
    message: 'Add API routes',
    author: 'Octocat',
    authorLogin: 'octocat',
    date: '2026-10-03T10:00:00Z',
  })
  assert.equal('manifest' in stack, false)
  const manifestRequest = requests.find(({ url }) => url.pathname.endsWith('/contents/package.json'))
  assert.equal(manifestRequest.url.searchParams.get('ref'), 'feature/api')
  assert.equal(manifestRequest.options.headers.Authorization, 'Bearer test-token')
})

test('stack analysis falls back to manual selection when package.json is missing', async () => {
  const fetchImpl = async (url) => {
    if (new URL(url).pathname === '/repositories/42') {
      return { ok: true, json: async () => ({ id: 42, full_name: 'octocat/empty', default_branch: 'main' }) }
    }
    return { status: 404, ok: false }
  }

  const stack = await analyzeGitHubRepositoryStack('test-token', 42, 'main', fetchImpl)
  assert.equal(stack.detected, false)
  assert.equal(stack.projectType, null)
})

test('fetches and maps all pages of authenticated GitHub repositories', async () => {
  const requests = []
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    id: index + 1,
    name: `repo-${index + 1}`,
    full_name: `octocat/repo-${index + 1}`,
    private: index === 0,
    default_branch: 'main',
    owner: { login: 'octocat', avatar_url: 'https://avatars.example/octocat' },
  }))
  const fetchImpl = async (url, options) => {
    requests.push({ url: new URL(url), options })
    return {
      ok: true,
      json: async () => requests.length === 1 ? firstPage : [{
        id: 101,
        name: 'repo-101',
        full_name: 'octocat/repo-101',
        private: false,
        default_branch: 'main',
        owner: { login: 'octocat', avatar_url: 'https://avatars.example/octocat' },
      }],
    }
  }

  const repositories = await fetchGitHubRepositories('test-token', fetchImpl)

  assert.equal(repositories.length, 101)
  assert.deepEqual(requests.map(({ url }) => url.searchParams.get('page')), ['1', '2'])
  assert.equal(requests[0].options.headers.Authorization, 'Bearer test-token')
  assert.deepEqual(repositories[0], {
    id: 1,
    name: 'repo-1',
    fullName: 'octocat/repo-1',
    description: undefined,
    private: true,
    htmlUrl: undefined,
    defaultBranch: 'main',
    language: undefined,
    updatedAt: undefined,
    owner: { login: 'octocat', avatarUrl: 'https://avatars.example/octocat' },
  })
})

test('repository lookup only returns repositories available to the authenticated account', async () => {
  const fetchImpl = async (url) => new URL(url).pathname === '/repositories/42' ? ({
    ok: true,
    json: async () => ({
      id: 42,
      name: 'deployhub-demo',
      full_name: 'octocat/deployhub-demo',
      html_url: 'https://github.com/octocat/deployhub-demo',
      default_branch: 'main',
      owner: { login: 'octocat' },
    }),
  }) : ({ status: 404, ok: false })

  const repository = await findGitHubRepositoryById('test-token', 42, fetchImpl)
  assert.equal(repository.fullName, 'octocat/deployhub-demo')
  await assert.rejects(
    findGitHubRepositoryById('test-token', 43, fetchImpl),
    (error) => error.code === 'GITHUB_REPOSITORY_NOT_FOUND' && error.statusCode === 404,
  )
})