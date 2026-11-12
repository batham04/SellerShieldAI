import { Router } from 'express';
import { body, param } from 'express-validator';
import { createRequest, decideRequest, listRequests } from '../controllers/refundController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', listRequests);
router.post('/', allowRoles('customer'), [body('orderId').isMongoId(), body('reason').trim().isLength({ min: 5, max: 3000 }), body('requestedAmount').optional().isFloat({ gt: 0 }).toFloat(), body('evidence').optional().isArray({ max: 10 }), body('evidence.*').optional().isString().isLength({ max: 500 })], createRequest);
router.patch('/:id', allowRoles('seller'), [param('id').isMongoId(), body('decision').isIn(['approved', 'rejected'])], decideRequest);
export default router;
