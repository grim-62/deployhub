import { getHealth } from '../services/healthService.js'
import { asyncHandler } from '../utils/asyncHandler.js'

export const healthController = asyncHandler((request, response) => {
  response.status(200).json(getHealth())
})