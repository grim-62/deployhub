import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) })
const port = Number(process.env.PORT || 5000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port number.')
}
const sessionSecretConfigured = Boolean(process.env.SESSION_SECRET)
if (sessionSecretConfigured && process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long.')
}

const nodeEnv = process.env.NODE_ENV || 'development'
const deploymentProtocol = process.env.DEPLOYMENT_PROTOCOL || 'http'
if (!['http', 'https'].includes(deploymentProtocol)) {
  throw new Error('DEPLOYMENT_PROTOCOL must be http or https.')
}
const requiredProductionVariables = ['DATABASE_URL', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_CALLBACK_URL', 'SESSION_SECRET']
if (nodeEnv === 'production') {
  const missing = requiredProductionVariables.filter((name) => !process.env[name])
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
}

export const env = Object.freeze({
  port,
  databaseUrl: process.env.DATABASE_URL || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  githubCallbackUrl: process.env.GITHUB_CALLBACK_URL || '',
  deploymentDomain: process.env.DEPLOYMENT_DOMAIN || '',
  deploymentProtocol,
  deploymentEncryptionKey: process.env.DEPLOYMENT_ENCRYPTION_KEY || '',
  deploymentDockerNetwork: process.env.DEPLOYMENT_DOCKER_NETWORK || 'deployhub_default',
  deploymentNginxContainer: process.env.DEPLOYMENT_NGINX_CONTAINER || 'deployhub-nginx',
  deploymentNginxConfigDir: process.env.DEPLOYMENT_NGINX_CONFIG_DIR || '/deployment-nginx',
  adminGitHubUsers: (process.env.ADMIN_GITHUB_USERS || '').split(',').map((username) => username.trim().toLowerCase()).filter(Boolean),
  sessionSecret: process.env.SESSION_SECRET || randomBytes(48).toString('hex'),
  sessionSecretConfigured,
  sessionCookieName: 'deployhub.sid',
  nodeEnv,
})