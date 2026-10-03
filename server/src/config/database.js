import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg

function logDatabaseConnectionDetails(connectionString) {
  if (!connectionString) return
  try {
    const connection = new URL(connectionString)
    const userInfo = connection.username
      ? `${decodeURIComponent(connection.username)}:${connection.password ? '[REDACTED]' : ''}@`
      : ''
    console.info(`[database] DATABASE_URL=${connection.protocol}//${userInfo}${connection.host}${connection.pathname}`)
  } catch {
    console.info('[database] Connection string is configured; details could not be parsed.')
  }
}

logDatabaseConnectionDetails(env.databaseUrl)

export const database = env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl, max: 10, idleTimeoutMillis: 30000 })
  : null

database?.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message)
})