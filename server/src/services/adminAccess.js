import { env } from '../config/env.js'

export function isAdminGitHubUser(username, adminUsers = env.adminGitHubUsers) {
  return adminUsers.includes(String(username || '').trim().toLowerCase())
}