import { readdir } from 'node:fs/promises'
import { readFile } from 'node:fs/promises'
import { database } from './database.js'

export async function runMigrations() {
  if (!database) return
  const directory = new URL('../database/migrations/', import.meta.url)
  const migrations = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of migrations) {
    const migration = await readFile(new URL(file, directory), 'utf8')
    await database.query(migration)
  }
}