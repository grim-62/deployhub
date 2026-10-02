import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

function getEncryptionKey(keyText = env.deploymentEncryptionKey) {
  const key = /^[a-f0-9]{64}$/i.test(keyText) ? Buffer.from(keyText, 'hex') : Buffer.from(keyText, 'base64')
  if (key.length !== 32) {
    throw new AppError(503, 'DEPLOYMENT_ENCRYPTION_UNAVAILABLE', 'Set a 32-byte DEPLOYMENT_ENCRYPTION_KEY before saving environment variables.')
  }
  return key
}

export function encryptEnvironmentVariables(variables, keyText) {
  if (!Object.keys(variables).length) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(keyText), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(variables), 'utf8'),
    cipher.final(),
  ])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptEnvironmentVariables(value, keyText) {
  if (!value) return {}
  try {
    const [version, ivText, tagText, ciphertextText] = value.split('.')
    if (version !== 'v1' || !ivText || !tagText || !ciphertextText) throw new Error('Invalid encrypted value.')
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(keyText), Buffer.from(ivText, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const variables = JSON.parse(plaintext)
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new Error('Invalid encrypted value.')
    return variables
  } catch {
    throw new AppError(500, 'DEPLOYMENT_CONFIG_UNAVAILABLE', 'Saved deployment configuration could not be decrypted.')
  }
}