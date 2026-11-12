import { Router } from 'express';
import { body } from 'express-validator';
import { currentUser, getSettings, login, register, updateSettings } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const email = body('email').isEmail().normalizeEmail();

router.post('/register', [body('name').trim().isLength({ min: 2, max: 100 }), email, body('password').isLength({ min: 8, max: 128 }), body('role').optional().isIn(['seller', 'customer'])], register);
router.post('/login', [email, body('password').isString().notEmpty().isLength({ max: 128 })], login);
router.get('/me', requireAuth, currentUser);
router.get('/settings', requireAuth, allowRoles('seller'), getSettings);
router.put('/settings', requireAuth, allowRoles('seller'), [body('name').optional().trim().isLength({ min: 2, max: 100 }), body('storeName').optional().trim().isLength({ max: 120 }), body('website').optional().isURL({ require_protocol: true }).isLength({ max: 300 }), body('description').optional().trim().isLength({ max: 1000 }), body('returnWindow').optional().isIn(['14 days', '30 days', '60 days', 'Final sale']), body('acceptReturns').optional().isBoolean(), body('refundPolicy').optional().trim().isLength({ max: 3000 })], updateSettings);
export default router;
