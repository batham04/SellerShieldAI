import { Router } from 'express';
import { body, query } from 'express-validator';
import { analyzeRefund, businessInsights, chat, listConversations } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(requireAuth);
router.get('/conversations', listConversations);
router.get('/business-insights', allowRoles('seller'), [query('range').optional().matches(/^(7|30|90)d$/)], businessInsights);
router.post('/chat', [body('message').isString().trim().isLength({ min: 1, max: 4000 }), body('conversationId').optional().isMongoId()], chat);
router.post('/refund/analyze', allowRoles('customer'), [body('orderId').isMongoId(), body('reason').isString().trim().isLength({ min: 5, max: 3000 }), body('evidence').optional().isArray({ max: 10 }), body('evidence.*').optional().isString().isLength({ max: 500 })], analyzeRefund);
export default router;
