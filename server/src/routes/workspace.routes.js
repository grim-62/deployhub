import { Router } from 'express'
import { z } from 'zod'
import { createProject, deleteProject, getProject, listActivity, listDeployments, listProjects, queueProjectDeployment } from '../controllers/workspaceController.js'
import { getDeployment, getDeploymentLogs } from '../controllers/deploymentController.js'
import { requireAuth } from '../middleware/errorHandler.js'
import { validateRequest } from '../middleware/validateRequest.js'

const router = Router()

router.get('/projects', requireAuth, listProjects)
router.get('/projects/:id', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), getProject)
router.delete('/projects/:id', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), deleteProject)
router.post('/projects', requireAuth, validateRequest({
	body: z.object({
		githubRepoId: z.coerce.number().int().positive(),
		projectType: z.enum(['frontend', 'backend']),
		branch: z.string().trim().min(1).max(255).regex(/^[A-Za-z0-9._/-]+$/).refine((value) => !value.startsWith('-') && !value.includes('..'), 'Branch name is invalid.').optional(),
		environmentVariables: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), z.string().max(4096).refine((value) => !/[\r\n\0]/.test(value), 'Environment values cannot contain newlines or null bytes.')).default({}).refine((variables) => Object.keys(variables).length <= 50, 'At most 50 environment variables are allowed.'),
	}),
}), createProject)
router.post('/projects/:id/deploy', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), queueProjectDeployment)
router.get('/deployments', requireAuth, listDeployments)
router.get('/deployments/:id', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), getDeployment)
router.get('/deployments/:id/logs', requireAuth, validateRequest({
	params: z.object({ id: z.coerce.number().int().positive() }),
}), getDeploymentLogs)
router.get('/activity', requireAuth, listActivity)

export default router