import { Router } from 'express'
import { z } from 'zod'
import { deleteProject, getProjectDetails, listLiveProjects } from '../controllers/adminController.js'
import { requireAdmin } from '../middleware/errorHandler.js'
import { validateRequest } from '../middleware/validateRequest.js'

const router = Router()

router.use(requireAdmin)
router.get('/projects/live', listLiveProjects)
router.get('/projects/:id', validateRequest({
  params: z.object({ id: z.coerce.number().int().positive() }),
}), getProjectDetails)
router.delete('/projects/:id', validateRequest({
  params: z.object({ id: z.coerce.number().int().positive() }),
}), deleteProject)

export default router