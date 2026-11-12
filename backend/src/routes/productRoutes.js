import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from '../controllers/productController.js';
import { optionalAuth, requireAuth } from '../middleware/authMiddleware.js';
import { allowRoles } from '../middleware/roleMiddleware.js';

const router = Router();
const productFields = [
  body('name').trim().isLength({ min: 1, max: 160 }),
  body('description').trim().isLength({ min: 1, max: 3000 }),
  body('price').isFloat({ min: 0 }).custom(value => Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 1e-7).withMessage('Price may have at most two decimal places.').toFloat(),
  body('category').trim().isLength({ min: 1, max: 80 }),
  body('image').optional({ values: 'falsy' }).isURL({ require_protocol: true }).isLength({ max: 1000 }),
  body('stock').isInt({ min: 0 }).toInt(),
];

router.get('/', optionalAuth, [query('maxPrice').optional().isFloat({ min: 0 }), query('q').optional().isString().isLength({ max: 100 }), query('category').optional().isString().isLength({ max: 80 })], listProducts);
router.get('/:id', param('id').isMongoId(), getProduct);
router.post('/', requireAuth, allowRoles('seller'), productFields, createProduct);
router.put('/:id', requireAuth, allowRoles('seller'), [param('id').isMongoId(), ...productFields], updateProduct);
router.delete('/:id', requireAuth, allowRoles('seller'), param('id').isMongoId(), deleteProduct);
export default router;
