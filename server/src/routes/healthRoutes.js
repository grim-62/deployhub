import { Router } from 'express'
import { healthController } from '../controllers/healthController.js'

const router = Router()

router.get('/health', healthController)

export default router