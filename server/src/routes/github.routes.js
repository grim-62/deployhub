import { Router } from 'express'
import { z } from 'zod'
import { analyzeGitHubRepository, getGitHubRepository, listGitHubRepositories } from '../controllers/githubController.js'
import { requireAuth } from '../middleware/errorHandler.js'
import { validateRequest } from '../middleware/validateRequest.js'

const router = Router()

router.get('/repositories', requireAuth, listGitHubRepositories)
router.get('/repositories/:id/stack', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
	query: z.object({ branch: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/).optional() }),
}), analyzeGitHubRepository)
router.get('/repositories/:id', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), getGitHubRepository)

export default router