import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { releaseOrderReservation } from '../services/orderService.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

const sellerFilter = user => ({ 'items.sellerId': user._id });

export const listOrders = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'seller' ? sellerFilter(req.user) : { customerId: req.user._id };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(200).populate('customerId', 'name email').lean();
  res.json(orders.map(order => ({ ...order, id: String(order._id), customer: order.customerId, total: order.totalAmount, status: order.orderStatus })));
});

export const getOrder = asyncHandler(async (req, res) => {
  const filter = req.user.role === 'seller'
    ? { _id: req.params.id, ...sellerFilter(req.user) }
    : { _id: req.params.id, customerId: req.user._id };
  const order = await Order.findOne(filter).populate('customerId', 'name email');
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json({ ...order.toJSON(), id: String(order._id), customer: order.customerId, total: order.totalAmount, status: order.orderStatus });
});

export const createOrder = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  if (!Array.isArray(req.body.items) || !req.body.items.length) return res.status(400).json({ message: 'Add at least one item to the order.' });
  const ids = req.body.items.map(item => String(item.productId || item.id));
  if (ids.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'An order item has an invalid product ID.' });
  const products = await Product.find({ _id: { $in: ids }, isActive: true });
  if (products.length !== new Set(ids).size) return res.status(400).json({ message: 'One or more products are unavailable.' });
  if (new Set(products.map(product => String(product.sellerId))).size !== 1) return res.status(400).json({ message: 'Items from different stores must be checked out separately.' });
  const productById = new Map(products.map(product => [String(product._id), product]));
  const quantities = new Map();
  for (const input of req.body.items) {
    const productId = String(input.productId || input.id);
    const quantity = Number(input.quantity);
    const totalQuantity = (quantities.get(productId) || 0) + quantity;
    const product = productById.get(productId);
    if (!Number.isInteger(quantity) || quantity < 1 || totalQuantity > 100 || product.stock < totalQuantity) {
      const error = new Error(`Invalid quantity or insufficient stock for ${product.name}.`); error.statusCode = 400; throw error;
    }
    quantities.set(productId, totalQuantity);
  }
  const items = [...quantities.entries()].map(([productId, quantity]) => {
    const product = productById.get(productId);
    return { productId: product._id, sellerId: product.sellerId, name: product.name, unitPrice: product.price, quantity, image: product.image };
  });
  const order = await Order.create({
    customerId: req.user._id,
    items,
    totalAmount: Number(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2)),
    currency: process.env.PAYPAL_CURRENCY || 'USD',
    shipping: req.body.shipping || {},
  });
  res.status(201).json({ ...order.toJSON(), total: order.totalAmount, status: order.orderStatus });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const allowed = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid order status.' });
  const order = await Order.findOne({ _id: req.params.id, ...sellerFilter(req.user) });
  if (!order) return res.status(404).json({ message: 'Order not found in your store.' });
  if (order.paymentStatus !== 'paid' && req.body.status !== 'cancelled') return res.status(409).json({ message: 'Only paid orders can be fulfilled.' });
  order.orderStatus = req.body.status;
  await order.save();
  if (req.body.status === 'cancelled') await releaseOrderReservation(order);
  res.json({ ...order.toJSON(), total: order.totalAmount, status: order.orderStatus });
});
