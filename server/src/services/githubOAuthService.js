import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

export function isGitHubOAuthConfigured() {
  return Boolean(
    env.githubClientId && env.githubClientSecret && env.githubCallbackUrl &&
    env.sessionSecretConfigured && env.databaseUrl,
  )
}

export function createGitHubAuthorizationUrl(state) {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', env.githubClientId)
  url.searchParams.set('redirect_uri', env.githubCallbackUrl)
  url.searchParams.set('scope', 'read:user repo')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeCodeForGitHubUser(code, state) {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'DeployHub' },
    body: JSON.stringify({
      client_id: env.githubClientId,
      client_secret: env.githubClientSecret,
      code,
      redirect_uri: env.githubCallbackUrl,
      state,
    }),
    signal: AbortSignal.timeout(12000),
  })
  const tokenPayload = await tokenResponse.json()
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new AppError(502, 'GITHUB_TOKEN_EXCHANGE_FAILED', 'GitHub could not complete sign in.')
  }

  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'User-Agent': 'DeployHub',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(12000),
  })
  if (!profileResponse.ok) {
    throw new AppError(502, 'GITHUB_PROFILE_FAILED', 'GitHub could not return your profile.')
  }

  const profile = await profileResponse.json()
  if (!Number.isSafeInteger(profile.id) || typeof profile.login !== 'string' || !profile.login) {
    throw new AppError(502, 'GITHUB_PROFILE_INVALID', 'GitHub returned an invalid profile.')
  }

  return {
    githubId: String(profile.id),
    username: profile.login,
    avatarUrl: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
    accessToken: tokenPayload.access_token,
  }
}