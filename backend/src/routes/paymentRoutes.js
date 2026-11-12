import { Router } from 'express';
import { body } from 'express-validator';
import { cancelPaymentOrder, capturePaymentOrder, createPaymentOrder, listTransactions } from '../controllers/paymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const itemsValidation = [body('items').isArray({ min: 1, max: 50 }), body('items.*.productId').isMongoId(), body('items.*.quantity').isInt({ min: 1, max: 100 }), body('shipping').optional().isObject(), body('shipping.email').optional().isEmail(), body('shipping.firstName').optional().isString().isLength({ max: 100 }), body('shipping.lastName').optional().isString().isLength({ max: 100 }), body('shipping.address').optional().isString().isLength({ max: 300 }), body('shipping.city').optional().isString().isLength({ max: 100 }), body('shipping.postalCode').optional().isString().isLength({ max: 30 }), body('shipping.country').optional().isIn(['United States', 'India', 'United Kingdom', 'Canada'])];
router.get('/transactions', requireAuth, listTransactions);
router.post('/payments/paypal/create', requireAuth, allowRoles('customer'), itemsValidation, createPaymentOrder);
router.post('/payments/paypal/capture', requireAuth, allowRoles('customer'), [body('paypalOrderId').optional().isString().isLength({ min: 5, max: 80 }), body('orderID').optional().isString().isLength({ min: 5, max: 80 }), body().custom(value => Boolean(value.paypalOrderId || value.orderID) || Promise.reject(new Error('paypalOrderId is required.')))], capturePaymentOrder);
router.post('/payments/paypal/cancel', requireAuth, allowRoles('customer'), [body('paypalOrderId').isString().isLength({ min: 5, max: 80 })], cancelPaymentOrder);
router.post('/paypal/create-order', requireAuth, allowRoles('customer'), itemsValidation, createPaymentOrder);
router.post('/paypal/capture-order/:orderId', requireAuth, allowRoles('customer'), capturePaymentOrder);
export default router;
