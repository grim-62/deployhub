import { randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { findPublicUserById, upsertGitHubUser } from '../models/userModel.js'
import { createGitHubAuthorizationUrl, exchangeCodeForGitHubUser, isGitHubOAuthConfigured } from '../services/githubOAuthService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'

function clientLoginUrl(error) {
  const url = new URL('/login', env.clientUrl)
  url.searchParams.set('error', error)
  return url.toString()
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
}

function saveSession(request) {
  return new Promise((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
}

export function startGitHubOAuth(request, response, next) {
  response.set('Cache-Control', 'no-store')
  if (!isGitHubOAuthConfigured()) return response.redirect(302, clientLoginUrl('github_not_configured'))

  const state = randomBytes(32).toString('hex')
  request.session.oauthState = state
  request.session.save((error) => {
    if (error) return next(error)
    return response.redirect(302, createGitHubAuthorizationUrl(state))
  })
}

export async function completeGitHubOAuth(request, response) {
  response.set('Cache-Control', 'no-store')
  if (request.query.error) return response.redirect(302, clientLoginUrl('github_cancelled'))

  const { code, state } = request.query
  const expectedState = request.session?.oauthState
  delete request.session?.oauthState
  if (typeof code !== 'string' || typeof state !== 'string' || typeof expectedState !== 'string') {
    return response.redirect(302, clientLoginUrl('oauth_state_invalid'))
  }
  const supplied = Buffer.from(state)
  const expected = Buffer.from(expectedState)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return response.redirect(302, clientLoginUrl('oauth_state_invalid'))
  }

  try {
    const githubUser = await exchangeCodeForGitHubUser(code, state)
    const user = await upsertGitHubUser(githubUser)
    await regenerateSession(request)
    request.session.userId = user.id
    await saveSession(request)
    return response.redirect(302, new URL('/dashboard', env.clientUrl).toString())
  } catch (error) {
    console.error('GitHub OAuth callback failed:', error.message)
    return response.redirect(302, clientLoginUrl('oauth_failed'))
  }
}

export const currentUser = asyncHandler(async (request, response) => {
  const user = await findPublicUserById(request.session.userId)
  if (!user) {
    request.session.destroy(() => {})
    return response.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
  }
  return sendSuccess(response, { user })
})

export function logout(request, response, next) {
  response.set('Cache-Control', 'no-store')
  response.clearCookie(env.sessionCookieName, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  })
  if (!request.session) return sendSuccess(response, { loggedOut: true })
  request.session.destroy((error) => {
    if (error) return next(error)
    return sendSuccess(response, { loggedOut: true })
  })
}