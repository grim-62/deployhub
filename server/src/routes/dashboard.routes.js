import { Router } from 'express'
import { dashboardController } from '../controllers/dashboard.controller.js'
import { requireAuth } from '../middleware/errorHandler.js'

const router = Router()

router.get('/', requireAuth, dashboardController)

export default router