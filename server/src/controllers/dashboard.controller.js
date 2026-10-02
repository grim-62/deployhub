import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/responses.js'
import { getDashboard } from '../services/dashboard.service.js'

export const dashboardController = asyncHandler(async (request, response) => {
  const dashboard = await getDashboard(request.session.userId)
  return sendSuccess(response, dashboard)
})