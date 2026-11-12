import { Router } from 'express';
import { body } from 'express-validator';
import { getSettings, updateSettings } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(requireAuth, allowRoles('seller'));
router.get('/', getSettings);
router.put('/', [body('name').optional().trim().isLength({ min: 2, max: 100 }), body('storeName').optional().trim().isLength({ max: 120 }), body('website').optional({ values: 'falsy' }).isURL({ require_protocol: true }).isLength({ max: 300 }), body('description').optional().trim().isLength({ max: 1000 }), body('returnWindow').optional().isIn(['14 days', '30 days', '60 days', 'Final sale']), body('acceptReturns').optional().isBoolean(), body('refundPolicy').optional().trim().isLength({ max: 3000 })], updateSettings);
export default router;
