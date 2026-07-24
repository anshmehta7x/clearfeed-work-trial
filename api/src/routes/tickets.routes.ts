import { Router } from 'express';
import { validateUuidParams } from '../middleware/validateUuid.js';
import * as ticketsController from '../controllers/tickets.controller.js';

const router = Router({ mergeParams: true }); // mounted under /companies/:companyId

router.get('/', validateUuidParams('companyId'), ticketsController.getTickets);

export default router;
