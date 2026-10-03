import * as dashboardRepository from '../repositories/dashboardRepository.js'
import { removeProjectResources } from '../services/deploymentRunner.js'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'

export const listLiveProjects = asyncHandler(async (request, response) => {
  const projects = await dashboardRepository.listAdminLiveProjects()
  return sendSuccess(response, { projects })
})

export const getProjectDetails = asyncHandler(async (request, response) => {
  const details = await dashboardRepository.getAdminProjectDetails(request.validated.params.id)
  if (!details) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Live project not found.')
  const project = { ...details.project }
  delete project.ownerId
  return sendSuccess(response, { project, deployments: details.deployments })
})

export const deleteProject = asyncHandler(async (request, response) => {
  const projectId = request.validated.params.id
  const details = await dashboardRepository.getAdminProjectDetails(projectId)
  if (!details) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Live project not found.')

  const deletedProject = await dashboardRepository.deleteProject(details.project.ownerId, projectId)
  if (!deletedProject) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Live project not found.')

  try {
    await removeProjectResources(deletedProject)
    return sendSuccess(response, { deleted: true, cleanupPending: false })
  } catch (error) {
    console.error(`Admin deleted project ${projectId}, but runtime cleanup failed:`, error.message)
    return sendSuccess(response, { deleted: true, cleanupPending: true }, 202)
  }
})