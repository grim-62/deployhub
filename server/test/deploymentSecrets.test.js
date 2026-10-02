import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decryptEnvironmentVariables, encryptEnvironmentVariables } from '../src/services/deploymentSecrets.js'

const encryptionKey = '2f'.repeat(32)

test('deployment environment variables encrypt and decrypt without changing values', () => {
  const variables = { API_KEY: 'private-value', EMPTY_VALUE: '' }
  const encrypted = encryptEnvironmentVariables(variables, encryptionKey)

  assert.equal(typeof encrypted, 'string')
  assert.notEqual(encrypted.includes('private-value'), true)
  assert.deepEqual(decryptEnvironmentVariables(encrypted, encryptionKey), variables)
  assert.equal(encryptEnvironmentVariables({}, encryptionKey), null)
  assert.deepEqual(decryptEnvironmentVariables(null, encryptionKey), {})
})

test('deployment environment variables reject invalid keys and tampered values', () => {
  assert.throws(() => encryptEnvironmentVariables({ API_KEY: 'value' }, 'too-short'), { code: 'DEPLOYMENT_ENCRYPTION_UNAVAILABLE' })
  const encrypted = encryptEnvironmentVariables({ API_KEY: 'value' }, encryptionKey)
  assert.throws(() => decryptEnvironmentVariables(`${encrypted}tampered`, encryptionKey), { code: 'DEPLOYMENT_CONFIG_UNAVAILABLE' })
})