import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAdminGitHubUser } from '../src/services/adminAccess.js'

test('admin access uses a normalized exact GitHub username allowlist', () => {
  const allowlist = ['octocat', 'deploy-admin']
  assert.equal(isAdminGitHubUser('OctoCat', allowlist), true)
  assert.equal(isAdminGitHubUser(' deploy-admin ', allowlist), true)
  assert.equal(isAdminGitHubUser('octocat-evil', allowlist), false)
  assert.equal(isAdminGitHubUser('', allowlist), false)
})