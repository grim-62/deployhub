import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { access, mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { env } from '../config/env.js'
import * as repository from '../repositories/dashboardRepository.js'
import { decryptEnvironmentVariables } from './deploymentSecrets.js'

const pollInterval = 1500

function redact(value, accessToken, secretValues = []) {
  const token = String(accessToken || '')
  const encodedToken = token ? Buffer.from(`x-access-token:${token}`).toString('base64') : ''
  return [token, encodedToken, ...secretValues].filter(Boolean).reduce(
    (output, secret) => output.replaceAll(secret, '[REDACTED]'),
    value,
  )
}

function run(command, args, { accessToken, secretValues = [], onOutput = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const output = []
    const child = spawn(command, args, {
      env: accessToken ? {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${accessToken}`).toString('base64')}`,
      } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })
    const streams = [child.stdout, child.stderr]
    for (const stream of streams) {
      const lines = createInterface({ input: stream })
      lines.on('line', (line) => {
        const safeLine = redact(line, accessToken, secretValues)
        output.push(safeLine)
        onOutput(safeLine)
      })
    }
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve(output.join('\n'))
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

export function createDeploymentHostname(projectName, projectId, domain) {
  const normalizedDomain = String(domain || '').toLowerCase().replace(/^\.+|\.+$/g, '')
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalizedDomain)) {
    throw new Error('Set a valid DEPLOYMENT_DOMAIN before deploying projects.')
  }
  const slug = String(projectName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'project'
  return `${slug}-${projectId}.${normalizedDomain}`
}

export function detectPackageManager(packageJson, lockFiles = []) {
  const declared = String(packageJson?.packageManager || '').split('@')[0]
  if (['npm', 'yarn', 'pnpm'].includes(declared)) return declared
  if (lockFiles.includes('pnpm-lock.yaml')) return 'pnpm'
  if (lockFiles.includes('yarn.lock')) return 'yarn'
  return 'npm'
}

export function createDockerfile(projectType, packageManager = 'npm', containerPort = 31000, hasLockFile = true) {
  if (!['npm', 'yarn', 'pnpm'].includes(packageManager)) {
    throw new Error('Package manager must be npm, yarn, or pnpm.')
  }
  if (!Number.isInteger(containerPort) || containerPort < 31000 || containerPort > 65535) {
    throw new Error('Container port must be between 31000 and 65535.')
  }
  const packageFiles = {
    npm: ['COPY package*.json ./'],
    yarn: ['RUN corepack enable', 'COPY package.json ./', ...(hasLockFile ? ['COPY yarn.lock ./'] : [])],
    pnpm: ['RUN corepack enable', 'COPY package.json ./', ...(hasLockFile ? ['COPY pnpm-lock.yaml ./'] : [])],
  }[packageManager]
  const installCommand = {
    npm: projectType === 'backend' ? 'npm install --omit=dev --no-audit --no-fund' : 'npm install --no-audit --no-fund',
    yarn: `yarn install${hasLockFile ? ' --frozen-lockfile' : ''}${projectType === 'backend' ? ' --production' : ''}`,
    pnpm: `pnpm install${hasLockFile ? ' --frozen-lockfile' : ''}${projectType === 'backend' ? ' --prod' : ''}`,
  }[packageManager]
  const packageSetup = [...packageFiles, `RUN ${installCommand}`]
  if (projectType === 'frontend') {
    return [
      '# syntax=docker/dockerfile:1.7',
      'FROM node:20-alpine AS build',
      'WORKDIR /app',
      ...packageSetup,
      'COPY . .',
      'RUN --mount=type=secret,id=deployhub-env,required=false node .deployhub-build.cjs',
      'FROM nginxinc/nginx-unprivileged:alpine',
      'COPY --from=build /app/dist /usr/share/nginx/html',
      'COPY .deployhub-site.conf /etc/nginx/conf.d/default.conf',
      `EXPOSE ${containerPort}`,
      '',
    ].join('\n')
  }
  if (projectType === 'backend') {
    return [
      'FROM node:20-alpine',
      'WORKDIR /app',
      ...packageSetup,
      'COPY --chown=node:node . .',
      'USER node',
      `ENV PORT=${containerPort}`,
      `EXPOSE ${containerPort}`,
      `CMD ["${packageManager}", "start"]`,
      '',
    ].join('\n')
  }
  throw new Error('Project type must be frontend or backend.')
}

export function createProjectNginxConfig(containerPort) {
  if (!Number.isInteger(containerPort) || containerPort < 31000 || containerPort > 65535) {
    throw new Error('Container port must be between 31000 and 65535.')
  }
  return [
    'server {',
    `    listen ${containerPort};`,
    '    root /usr/share/nginx/html;',
    '    index index.html;',
    '    location / {',
    '        try_files $uri $uri/ /index.html;',
    '    }',
    '}',
    '',
  ].join('\n')
}

export function createNginxConfig(hostname, containerName, containerPort, protocol = 'http', domain = '') {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(hostname)) {
    throw new Error('Deployment hostname is invalid.')
  }
  if (!/^deployhub-deployment-[0-9]+$/.test(containerName)) {
    throw new Error('Deployment container name is invalid.')
  }
  if (!Number.isInteger(containerPort) || containerPort < 31000 || containerPort > 65535) {
    throw new Error('Container port must be between 31000 and 65535.')
  }
  const proxyServer = [
    `    server_name ${hostname};`,
    '    location / {',
    `        proxy_pass http://${containerName}:${containerPort};`,
    '        proxy_set_header Host $host;',
    '        proxy_set_header X-Real-IP $remote_addr;',
    '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '        proxy_set_header X-Forwarded-Proto $scheme;',
    '    }',
  ]
  if (protocol === 'http') {
    return [
      'server {',
      '    listen 80;',
      ...proxyServer,
      '}',
      '',
    ].join('\n')
  }
  const validDomain = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
  if (protocol !== 'https' || !validDomain.test(domain) || !hostname.endsWith(`.${domain}`)) {
    throw new Error('A valid domain and deployment protocol are required.')
  }
  return [
    'server {',
    '    listen 80;',
    `    server_name ${hostname};`,
    '    return 301 https://$host$request_uri;',
    '}',
    'server {',
    '    listen 443 ssl;',
    ...proxyServer,
    `    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;`,
    `    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;`,
    '}',
    '',
  ].join('\n')
}

async function installNginxRoute(hostname, configText) {
  const destination = join(env.deploymentNginxConfigDir, `deployhub-${hostname}.conf`)
  const temporary = `${destination}.${process.pid}.tmp`
  await mkdir(env.deploymentNginxConfigDir, { recursive: true })
  let previousConfig = null
  try {
    previousConfig = await readFile(destination, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await writeFile(temporary, configText, { mode: 0o644 })
  await rename(temporary, destination)
  const restore = async () => {
    if (previousConfig === null) await rm(destination, { force: true })
    else await writeFile(destination, previousConfig, { mode: 0o644 })
    await run('docker', ['exec', env.deploymentNginxContainer, 'nginx', '-t'])
    await run('docker', ['exec', env.deploymentNginxContainer, 'nginx', '-s', 'reload'])
  }
  try {
    await run('docker', ['exec', env.deploymentNginxContainer, 'nginx', '-t'])
    await run('docker', ['exec', env.deploymentNginxContainer, 'nginx', '-s', 'reload'])
  } catch (error) {
    await restore().catch(() => {})
    throw error
  }
  return restore
}

async function runDeployment(deployment) {
  const { deploymentId, projectId, projectName, repositoryUrl, branch, projectType, accessToken } = deployment
  const appendLog = (message) => repository.appendDeploymentLog(deploymentId, message)
  const containerName = `deployhub-deployment-${deploymentId}`
  const imageName = `deployhub-project-${projectId}:deployment-${deploymentId}`
  const hostname = createDeploymentHostname(projectName, projectId, env.deploymentDomain)
  const containerPort = deployment.containerPort
  const sourceDirectory = await mkdtemp(join(tmpdir(), `deployhub-${deploymentId}-`))
  let containerStarted = false
  let rollbackNginxRoute
  let environmentDirectory
  const onOutput = (line) => appendLog(line).catch((error) => console.error('Could not save deployment output:', error.message))

  try {
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(repositoryUrl || '')) {
      throw new Error('The saved repository URL is invalid.')
    }
    if (!/^[A-Za-z0-9._/-]+$/.test(branch || '') || branch.startsWith('-')) {
      throw new Error('The saved repository branch is invalid.')
    }
    if (!/^[A-Za-z0-9_.-]+$/.test(env.deploymentDockerNetwork)) {
      throw new Error('DEPLOYMENT_DOCKER_NETWORK contains invalid characters.')
    }

    await appendLog('Cloning the selected repository.')
    await run('git', ['clone', '--depth', '1', '--single-branch', '--branch', branch, repositoryUrl, sourceDirectory], { accessToken, onOutput })
    const commitOutput = await run('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD'], { onOutput })
    const commitSha = commitOutput.split('\n').find((line) => /^[a-f0-9]{40}$/i.test(line))
    if (!commitSha) throw new Error('Git did not return a valid commit hash.')

    const packageJson = JSON.parse(await readFile(join(sourceDirectory, 'package.json'), 'utf8'))
    const lockFiles = await Promise.all(['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml'].map(async (file) => {
      try {
        await access(join(sourceDirectory, file))
        return file
      } catch {
        return null
      }
    }))
    const packageManager = detectPackageManager(packageJson, lockFiles.filter(Boolean))
    const hasLockFile = lockFiles.some((file) => file === `${packageManager === 'npm' ? 'package' : packageManager}-lock.json` || file === ({ npm: 'npm-shrinkwrap.json', yarn: 'yarn.lock', pnpm: 'pnpm-lock.yaml' })[packageManager])
    const dockerfile = createDockerfile(projectType, packageManager, containerPort, hasLockFile)
    await writeFile(join(sourceDirectory, 'Dockerfile.deployhub'), dockerfile)
    await writeFile(join(sourceDirectory, '.dockerignore'), '.git\nnode_modules\n.env\n.env.*\nDockerfile.deployhub\n')
    const environmentVariables = decryptEnvironmentVariables(deployment.environmentVariablesEncrypted)
    const environmentEntries = Object.entries(environmentVariables)
    let buildSecretPath
    let runtimeEnvironmentPath
    if (environmentEntries.length) {
      environmentDirectory = await mkdtemp(join(tmpdir(), `deployhub-env-${deploymentId}-`))
      buildSecretPath = join(environmentDirectory, 'build-environment.json')
      runtimeEnvironmentPath = join(environmentDirectory, 'runtime-environment')
      await writeFile(buildSecretPath, JSON.stringify(environmentVariables), { mode: 0o600 })
      await writeFile(runtimeEnvironmentPath, `${environmentEntries.map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 })
    }
    if (projectType === 'frontend') {
      await writeFile(join(sourceDirectory, '.deployhub-site.conf'), createProjectNginxConfig(containerPort))
      await writeFile(join(sourceDirectory, '.deployhub-build.cjs'), [
        "const fs = require('node:fs')",
        "const { spawnSync } = require('node:child_process')",
        "const secretPath = '/run/secrets/deployhub-env'",
        "const variables = fs.existsSync(secretPath) ? JSON.parse(fs.readFileSync(secretPath, 'utf8')) : {}",
        `const result = spawnSync(${JSON.stringify(packageManager)}, ['run', 'build'], { stdio: 'inherit', env: { ...process.env, ...variables } })`,
        'process.exit(result.status ?? 1)',
        '',
      ].join('\n'))
    }
    await repository.updateDeploymentStatus(deploymentId, projectId, 'BUILDING')
    await appendLog('Building the project container image.')
    const buildArguments = [
      'build', '--file', join(sourceDirectory, 'Dockerfile.deployhub'), '--tag', imageName,
      '--label', `deployhub.project=${projectId}`,
      '--label', `deployhub.deployment=${deploymentId}`,
    ]
    if (projectType === 'frontend' && buildSecretPath) {
      buildArguments.push('--secret', `id=deployhub-env,src=${buildSecretPath}`)
    }
    buildArguments.push(sourceDirectory)
    await run('docker', buildArguments, { onOutput, secretValues: environmentEntries.map(([, value]) => value) })

    await repository.updateDeploymentStatus(deploymentId, projectId, 'DEPLOYING')
    await appendLog('Starting the project container.')
    const runArguments = [
      'run', '--detach', '--name', containerName,
      '--network', env.deploymentDockerNetwork,
      '--restart', 'unless-stopped',
      '--memory', '512m', '--cpus', '1', '--pids-limit', '128',
      '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL',
      '--label', `deployhub.project=${projectId}`,
      imageName,
    ]
    if (projectType === 'backend' && runtimeEnvironmentPath) {
      runArguments.splice(2, 0, '--env-file', runtimeEnvironmentPath)
    }
    const containerIdOutput = await run('docker', runArguments)
    const containerId = containerIdOutput.trim().split('\n').at(-1)
    if (!/^[a-f0-9]{12,64}$/i.test(containerId || '')) {
      throw new Error('Docker did not return a valid container ID.')
    }
    containerStarted = true

    await appendLog('Configuring the Nginx route.')
    rollbackNginxRoute = await installNginxRoute(
      hostname,
      createNginxConfig(hostname, containerName, containerPort, env.deploymentProtocol, env.deploymentDomain),
    )
    const url = `${env.deploymentProtocol}://${hostname}`
    const previousContainerId = await repository.completeDeployment({ deploymentId, projectId, url, containerName, containerId, containerPort, commitSha })
    containerStarted = false
    rollbackNginxRoute = null
    if (previousContainerId && previousContainerId !== containerName) {
      await run('docker', ['rm', '--force', previousContainerId]).catch(() => {})
    }
  } catch (error) {
    if (rollbackNginxRoute) await rollbackNginxRoute().catch(() => {})
    if (containerStarted) await run('docker', ['rm', '--force', containerName]).catch(() => {})
    throw error
  } finally {
    await Promise.all([
      rm(sourceDirectory, { recursive: true, force: true }),
      ...(environmentDirectory ? [rm(environmentDirectory, { recursive: true, force: true })] : []),
    ])
  }
}

export function startDeploymentWorker({ interval = pollInterval } = {}) {
  let stopped = false
  let processing = false
  let timer

  const poll = async () => {
    if (stopped) return
    if (!processing) {
      processing = true
      try {
        const deployment = await repository.claimNextDeployment()
        if (deployment) {
          await repository.appendDeploymentLog(deployment.deploymentId, 'Deployment worker started.')
          try {
            await runDeployment(deployment)
          } catch (error) {
            const message = `Deployment failed: ${redact(error.message, deployment.accessToken)}`
            await repository.failDeployment(deployment, message)
            console.error(`Deployment ${deployment.deploymentId} failed:`, redact(error.message, deployment.accessToken))
          }
        }
      } catch (error) {
        console.error('Deployment worker could not process the queue:', error.message)
      } finally {
        processing = false
      }
    }
    if (!stopped) timer = setTimeout(poll, interval)
  }

  void poll()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}
