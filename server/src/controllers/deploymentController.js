import * as dashboardRepository from '../repositories/dashboardRepository.js'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'

export const getDeployment = asyncHandler(async (request, response) => {
  const deployment = await dashboardRepository.getDeployment(request.session.userId, request.validated.params.id)
  if (!deployment) throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.')
  return sendSuccess(response, { deployment })
})

export const getDeploymentLogs = asyncHandler(async (request, response) => {
  const logs = await dashboardRepository.getDeploymentLogs(request.session.userId, request.validated.params.id)
  if (logs === null) throw new AppError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.')
  return sendSuccess(response, { logs })
})