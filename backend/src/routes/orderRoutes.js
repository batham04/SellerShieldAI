import { Router } from 'express';
import { body, param } from 'express-validator';
import { createOrder, getOrder, listOrders, updateOrderStatus } from '../controllers/orderController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/', listOrders);
router.get('/:id', param('id').isMongoId(), getOrder);
router.post('/', allowRoles('customer'), [body('items').isArray({ min: 1, max: 50 }), body('items.*.quantity').isInt({ min: 1, max: 100 })], createOrder);
router.patch('/:id/status', allowRoles('seller'), [param('id').isMongoId(), body('status').isIn(['processing', 'shipped', 'delivered', 'cancelled'])], updateOrderStatus);
export default router;
