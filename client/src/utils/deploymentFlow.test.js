import test from 'node:test'
import assert from 'node:assert/strict'
import { getProjectNavigationTarget } from './deploymentFlow.js'

test('returns project route when the deployment is live', () => {
  assert.equal(getProjectNavigationTarget({ projectId: 42, status: 'LIVE' }), '/projects/42')
})

test('returns null while a deployment is still queued or building', () => {
  assert.equal(getProjectNavigationTarget({ projectId: 42, status: 'BUILDING' }), null)
  assert.equal(getProjectNavigationTarget({ projectId: 42, status: 'QUEUED' }), null)
})
