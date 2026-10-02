import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg

export const database = env.databaseUrl
  ? new Pool({ connectionString: env.databaseUrl, max: 10, idleTimeoutMillis: 30000 })
  : null

database?.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message)
})