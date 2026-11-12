import { Router } from 'express';
import { analytics } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.get('/analytics', requireAuth, allowRoles('seller'), analytics);
router.get('/overview', requireAuth, allowRoles('seller'), analytics);
export default router;
