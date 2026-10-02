import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchGitHubRepositories, findGitHubRepositoryById } from '../src/services/githubRepositoryService.js'

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
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [{
      id: 42,
      name: 'deployhub-demo',
      full_name: 'octocat/deployhub-demo',
      html_url: 'https://github.com/octocat/deployhub-demo',
      default_branch: 'main',
      owner: { login: 'octocat' },
    }],
  })

  const repository = await findGitHubRepositoryById('test-token', 42, fetchImpl)
  assert.equal(repository.fullName, 'octocat/deployhub-demo')
  await assert.rejects(
    findGitHubRepositoryById('test-token', 43, fetchImpl),
    (error) => error.code === 'GITHUB_REPOSITORY_NOT_FOUND' && error.statusCode === 404,
  )
})