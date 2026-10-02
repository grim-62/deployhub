import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/app.js'
import { getDashboard } from '../src/services/dashboard.service.js'

let server
let baseUrl

before(async () => {
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('health returns the documented API status', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    success: true,
    message: 'DeployHub API is running',
  })
})

test('current user rejects requests without a session', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    },
  })
})

test('dashboard rejects requests without an authenticated user', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  })
})

test('GitHub repositories rejects requests without an authenticated user', async () => {
  const response = await fetch(`${baseUrl}/api/github/repositories`)
  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
  })
})

test('workspace data collections reject requests without an authenticated user', async () => {
  for (const collection of ['projects', 'deployments', 'activity']) {
    const response = await fetch(`${baseUrl}/api/${collection}`)
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    })
  }
  const createResponse = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubRepoId: 1, projectType: 'frontend' }),
  })
  assert.equal(createResponse.status, 401)

  const detailResponse = await fetch(`${baseUrl}/api/projects/1`)
  assert.equal(detailResponse.status, 401)

  const deployResponse = await fetch(`${baseUrl}/api/projects/1/deploy`, { method: 'POST' })
  assert.equal(deployResponse.status, 401)

  const deploymentResponse = await fetch(`${baseUrl}/api/deployments/1`)
  assert.equal(deploymentResponse.status, 401)
})

test('dashboard service scopes statistics and recent data to its user', async () => {
  const calls = []
  const stats = { projects: 5, deployments: 28, successful: 25, failed: 3 }
  const recentDeployments = [{ id: 'deployment-1' }]
  const recentActivity = [{ id: 'activity-1' }]
  const repository = {
    getDashboardStats: async (userId) => { calls.push(['stats', userId]); return stats },
    getRecentDeployments: async (userId) => { calls.push(['deployments', userId]); return recentDeployments },
    getRecentActivity: async (userId) => { calls.push(['activity', userId]); return recentActivity },
  }

  assert.deepEqual(await getDashboard('user-42', repository), { stats, recentDeployments, recentActivity })
  assert.deepEqual(calls, [['stats', 'user-42'], ['deployments', 'user-42'], ['activity', 'user-42']])
})

test('OAuth callback rejects a missing session-bound state', async () => {
  const response = await fetch(`${baseUrl}/api/auth/github/callback?code=untrusted&state=untrusted`, {
    redirect: 'manual',
  })
  const location = new URL(response.headers.get('location'))
  assert.equal(response.status, 302)
  assert.equal(location.pathname, '/login')
  assert.equal(location.searchParams.get('error'), 'oauth_state_invalid')
})

test('unknown API routes use the standard error envelope', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`)
  const payload = await response.json()
  assert.equal(response.status, 404)
  assert.equal(payload.success, false)
  assert.equal(payload.error.code, 'NOT_FOUND')
  assert.equal(typeof payload.error.message, 'string')
})