import { findGitHubAccessTokenByUserId } from '../models/userModel.js'
import { analyzeGitHubRepositoryStack, fetchGitHubRepositories, findGitHubRepositoryById } from '../services/githubRepositoryService.js'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'

export const listGitHubRepositories = asyncHandler(async (request, response) => {
  const accessToken = await findGitHubAccessTokenByUserId(request.session.userId)
  if (!accessToken) {
    throw new AppError(401, 'GITHUB_ACCESS_REQUIRED', 'Reconnect GitHub to grant repository access.')
  }

  const repositories = await fetchGitHubRepositories(accessToken)
  return sendSuccess(response, { repositories })
})

export const getGitHubRepository = asyncHandler(async (request, response) => {
  const accessToken = await findGitHubAccessTokenByUserId(request.session.userId)
  if (!accessToken) {
    throw new AppError(401, 'GITHUB_ACCESS_REQUIRED', 'Reconnect GitHub to grant repository access.')
  }

  const repository = await findGitHubRepositoryById(accessToken, request.validated.params.id)
  return sendSuccess(response, { repository })
})

export const analyzeGitHubRepository = asyncHandler(async (request, response) => {
  const accessToken = await findGitHubAccessTokenByUserId(request.session.userId)
  if (!accessToken) {
    throw new AppError(401, 'GITHUB_ACCESS_REQUIRED', 'Reconnect GitHub to grant repository access.')
  }

  const stack = await analyzeGitHubRepositoryStack(
    accessToken,
    request.validated.params.id,
    request.validated.query.branch,
  )
  return sendSuccess(response, { stack })
})