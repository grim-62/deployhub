import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDeploymentHostname, createDockerfile, createNginxConfig, createProjectNginxConfig, detectPackageManager } from '../src/services/deploymentRunner.js'

test('deployment hostnames sanitize project names and validate the configured domain', () => {
  assert.equal(createDeploymentHostname('My React App!', 42, 'example.com'), 'my-react-app-42.example.com')
  assert.throws(() => createDeploymentHostname('app', 42, 'not a domain'), /DEPLOYMENT_DOMAIN/)
})

test('package manager detection respects package metadata and lockfiles', () => {
  assert.equal(detectPackageManager({ packageManager: 'pnpm@9.1.0' }, ['yarn.lock']), 'pnpm')
  assert.equal(detectPackageManager({}, ['yarn.lock']), 'yarn')
  assert.equal(detectPackageManager({}, []), 'npm')
})

test('Dockerfiles use the selected project type and detected package manager', () => {
  const frontend = createDockerfile('frontend', 'pnpm', 31001)
  assert.match(frontend, /pnpm install --frozen-lockfile/)
  assert.match(frontend, /RUN --mount=type=secret,id=deployhub-env/)
  assert.match(frontend, /node \.deployhub-build\.cjs/)
  assert.match(frontend, /EXPOSE 31001/)
  assert.match(frontend, /\.deployhub-site\.conf/)
  assert.match(frontend, /nginx-unprivileged/)
  const unlockedYarn = createDockerfile('frontend', 'yarn', 31001, false)
  assert.doesNotMatch(unlockedYarn, /COPY yarn\.lock/)
  assert.match(unlockedYarn, /RUN yarn install\n/)

  const backend = createDockerfile('backend', 'npm', 31002)
  assert.match(backend, /npm install --omit=dev/)
  assert.match(backend, /ENV PORT=31002/)
  assert.match(backend, /USER node/)
  assert.match(backend, /npm", "start/)
})

test('Nginx config proxies the deployment hostname to its isolated container', () => {
  const config = createNginxConfig('app-42.example.com', 'deployhub-deployment-42', 31000, 'https', 'example.com')
  assert.match(config, /server_name app-42\.example\.com/)
  assert.match(config, /proxy_pass http:\/\/deployhub-deployment-42:31000/)
  assert.match(config, /listen 443 ssl/)
  assert.match(config, /fullchain\.pem/)
  assert.match(createNginxConfig('app-42.example.com', 'deployhub-deployment-42', 31000), /listen 80/)
  assert.throws(() => createNginxConfig('app-42.example.com', 'deployhub-deployment-42', 31000, 'https', 'bad domain'), /valid domain/)
  assert.match(createProjectNginxConfig(31001), /listen 31001/)
})