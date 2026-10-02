import { database } from '../config/database.js'
import { AppError } from '../utils/AppError.js'

function getDatabase() {
  if (!database) throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is not configured.')
  return database
}

function toPublicUser(row) {
  return {
    id: String(row.id),
    githubUsername: row.github_username,
    githubAvatarUrl: row.github_avatar_url,
  }
}

export async function upsertGitHubUser({ githubId, username, avatarUrl, accessToken }) {
  const result = await getDatabase().query(
    `INSERT INTO users (github_id, github_username, github_avatar_url, github_access_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id) DO UPDATE SET
       github_username = EXCLUDED.github_username,
       github_avatar_url = EXCLUDED.github_avatar_url,
       github_access_token = EXCLUDED.github_access_token,
       updated_at = NOW()
     RETURNING id, github_username, github_avatar_url`,
    [githubId, username, avatarUrl, accessToken],
  )
  return toPublicUser(result.rows[0])
}

export async function findPublicUserById(id) {
  const result = await getDatabase().query(
    'SELECT id, github_username, github_avatar_url FROM users WHERE id = $1',
    [id],
  )
  return result.rows[0] ? toPublicUser(result.rows[0]) : null
}

export async function findGitHubAccessTokenByUserId(id) {
  const result = await getDatabase().query(
    'SELECT github_access_token FROM users WHERE id = $1',
    [id],
  )
  return result.rows[0]?.github_access_token ?? null
}