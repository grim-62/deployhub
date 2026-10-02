import * as dashboardRepository from '../repositories/dashboardRepository.js'
import { findGitHubAccessTokenByUserId } from '../models/userModel.js'
import { findGitHubRepositoryById } from '../services/githubRepositoryService.js'
import { encryptEnvironmentVariables } from '../services/deploymentSecrets.js'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'

export const listProjects = asyncHandler(async (request, response) => {
  const projects = await dashboardRepository.listProjects(request.session.userId)
  return sendSuccess(response, { projects })
})

export const listDeployments = asyncHandler(async (request, response) => {
  const deployments = await dashboardRepository.listDeployments(request.session.userId)
  return sendSuccess(response, { deployments })
})

export const listActivity = asyncHandler(async (request, response) => {
  const activity = await dashboardRepository.listActivity(request.session.userId)
  return sendSuccess(response, { activity })
})

export const createProject = asyncHandler(async (request, response) => {
  const accessToken = await findGitHubAccessTokenByUserId(request.session.userId)
  if (!accessToken) {
    throw new AppError(401, 'GITHUB_ACCESS_REQUIRED', 'Reconnect GitHub to grant repository access.')
  }

  const repository = await findGitHubRepositoryById(accessToken, request.validated.body.githubRepoId)
  const environmentVariables = request.validated.body.environmentVariables || {}
  const environmentVariablesEncrypted = encryptEnvironmentVariables(environmentVariables)
  const project = await dashboardRepository.createProject(request.session.userId, {
    repository,
    projectType: request.validated.body.projectType,
    branch: request.validated.body.branch,
    environmentVariablesEncrypted,
  })
  if (!project) {
    throw new AppError(409, 'PROJECT_ALREADY_EXISTS', 'This repository is already connected to your projects.')
  }

  return sendSuccess(response, { project }, 201)
})

export const getProject = asyncHandler(async (request, response) => {
  const project = await dashboardRepository.getProject(request.session.userId, request.validated.params.id)
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.')
  return sendSuccess(response, { project })
})

export const queueProjectDeployment = asyncHandler(async (request, response) => {
  const deployment = await dashboardRepository.queueProjectDeployment(request.session.userId, request.validated.params.id)
  if (!deployment) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.')
  return sendSuccess(response, { deployment }, 202)
})