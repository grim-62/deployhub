import { Router } from 'express'
import { z } from 'zod'
import { getGitHubRepository, listGitHubRepositories } from '../controllers/githubController.js'
import { requireAuth } from '../middleware/errorHandler.js'
import { validateRequest } from '../middleware/validateRequest.js'

const router = Router()

router.get('/repositories', requireAuth, listGitHubRepositories)
router.get('/repositories/:id', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), getGitHubRepository)

export default router