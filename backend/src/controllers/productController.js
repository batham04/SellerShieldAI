import { validationResult } from 'express-validator';
import Product from '../models/Product.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

export const listProducts = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const filter = { isActive: true };
  if (req.user?.role === 'seller') filter.sellerId = req.user._id;
  if (req.query.category) filter.category = String(req.query.category).trim();
  if (req.query.maxPrice !== undefined) filter.price = { $lte: Number(req.query.maxPrice) };
  if (req.query.sellerId) filter.sellerId = req.query.sellerId;
  if (req.query.q) filter.$text = { $search: String(req.query.q).slice(0, 100) };
  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  res.json(products.map(product => ({ ...product, id: String(product._id), sellerId: String(product.sellerId) })));
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json({ ...product, id: String(product._id), sellerId: String(product.sellerId) });
});

export const createProduct = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const { name, description, price, category, image = '', stock } = req.body;
  const product = await Product.create({ name, description, price, category, image, stock, sellerId: req.user._id });
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const { name, description, price, category, image, stock } = req.body;
  const updates = Object.fromEntries(Object.entries({ name, description, price, category, image, stock }).filter(([, value]) => value !== undefined));
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user._id, isActive: true },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found in your store.' });
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, sellerId: req.user._id, isActive: true },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found in your store.' });
  res.json({ message: 'Product archived.' });
});
