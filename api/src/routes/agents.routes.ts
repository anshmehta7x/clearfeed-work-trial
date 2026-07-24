import { Router } from 'express';
import { validateUuidParams } from '../middleware/validateUuid.js';
import * as agentsController from '../controllers/agents.controller.js';

const router = Router({ mergeParams: true }); // mounted under /companies/:companyId

router.get('/', validateUuidParams('companyId'), agentsController.getAgents);
router.put(
  '/:agentId/availability',
  validateUuidParams('companyId', 'agentId'),
  agentsController.updateAvailability
);

export default router;
