import { Router } from 'express'
import { currentUser, completeGitHubOAuth, logout, startGitHubOAuth } from '../controllers/authController.js'
import { requireAuth } from '../middleware/errorHandler.js'

const router = Router()

router.get('/github', startGitHubOAuth)
router.get('/github/callback', completeGitHubOAuth)
router.get('/me', requireAuth, currentUser)
router.post('/logout', logout)

export default router