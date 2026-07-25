import { Router } from 'express';
import ticketsRoutes from './tickets.routes.js';
import agentsRoutes from './agents.routes.js';

const router = Router();
router.use('/companies/:companyId/tickets', ticketsRoutes);
router.use('/companies/:companyId/agents', agentsRoutes);

export default router;
