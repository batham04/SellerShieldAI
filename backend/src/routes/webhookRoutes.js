import { Router } from 'express';
import { receivePaypalWebhook } from '../controllers/paymentController.js';

const router = Router();
router.post('/paypal/webhook', receivePaypalWebhook);
router.post('/webhooks/paypal', receivePaypalWebhook);
export default router;
