import mongoose from 'mongoose';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../utils/apiResponse.js';

export const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId', 'name description price category image stock isActive');
  const items = (cart?.items || []).filter(item => item.productId?.isActive).map(item => ({
    id: String(item.productId._id), productId: String(item.productId._id),
    name: item.productId.name, description: item.productId.description,
    category: item.productId.category, image: item.productId.image,
    price: item.productId.price, stock: item.productId.stock, quantity: item.quantity,
  }));
  res.json({ items });
});

export const updateCart = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body.items) || req.body.items.length > 50) return res.status(400).json({ message: 'Cart items must be an array of up to 50 entries.' });
  const normalized = new Map();
  for (const item of req.body.items) {
    const productId = String(item.productId || item.id || '');
    const quantity = Number(item.quantity);
    if (!mongoose.isValidObjectId(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) return res.status(400).json({ message: 'Each cart item needs a valid product ID and quantity from 1 to 100.' });
    normalized.set(productId, quantity);
  }
  const products = await Product.find({ _id: { $in: [...normalized.keys()] }, isActive: true }).select('_id stock');
  if (products.length !== normalized.size) return res.status(400).json({ message: 'One or more cart products are unavailable.' });
  for (const product of products) if (normalized.get(String(product._id)) > product.stock) return res.status(409).json({ message: 'Requested quantity exceeds available stock.' });
  const items = products.map(product => ({ productId: product._id, quantity: normalized.get(String(product._id)) }));
  const cart = await Cart.findOneAndUpdate({ userId: req.user._id }, { $set: { userId: req.user._id, items } }, { new: true, upsert: true });
  res.json({ items: cart.items.map(item => ({ productId: String(item.productId), quantity: item.quantity })) });
});
