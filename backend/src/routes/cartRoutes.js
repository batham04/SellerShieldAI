import { Router } from 'express';
import { getCart, updateCart } from '../controllers/cartController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(requireAuth, allowRoles('customer'));
router.get('/', getCart);
router.put('/', updateCart);
export default router;
