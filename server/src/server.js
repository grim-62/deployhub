import app from './app.js'
import { env } from './config/env.js'
import { database } from './config/database.js'
import { runMigrations } from './config/migrate.js'
import { startDeploymentWorker } from './services/deploymentRunner.js'

async function startServer() {
  await runMigrations()
  const stopDeploymentWorker = database ? startDeploymentWorker() : () => {}
  const server = app.listen(env.port, () => {
    console.log(`DeployHub API listening on http://localhost:${env.port}`)
  })
  const shutdown = () => {
    stopDeploymentWorker()
    server.close(() => database?.end())
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  server.on('error', async (error) => {
    if (error.code !== 'EADDRINUSE') {
      console.error('DeployHub API failed to listen:', error.message)
      process.exitCode = 1
      return
    }

    try {
      const origin = `http://127.0.0.1:${env.port}`
      const [healthResponse, dashboardResponse] = await Promise.all([
        fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(2000) }),
        fetch(`${origin}/api/dashboard`, { signal: AbortSignal.timeout(2000) }),
      ])
      const health = await healthResponse.json()
      const dashboard = await dashboardResponse.json()
      if (
        healthResponse.ok && health.message === 'DeployHub API is running' &&
        dashboardResponse.status === 401 && dashboard.error?.code === 'UNAUTHORIZED'
      ) {
        console.log(`Reusing the existing DeployHub API on port ${env.port}`)
        return
      }
    } catch {
      // Report the occupied port below when it does not serve this API.
    }

    console.error(`Port ${env.port} is already in use by another service.`)
    process.exitCode = 1
  })
}

startServer().catch(async (error) => {
  console.error('DeployHub API failed to start:', error.message)
  await database?.end()
  process.exitCode = 1
})