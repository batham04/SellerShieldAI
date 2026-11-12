import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { asyncHandler, validationResultOrThrow } from '../utils/apiResponse.js';

function publicUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role, storeName: user.storeName };
}

function signToken(user) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    const error = new Error('JWT_SECRET must contain at least 32 characters.');
    error.statusCode = 503;
    throw error;
  }
  return jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export const register = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const { name, email, password, role = 'customer' } = req.body;
  const user = await User.create({ name, email: email.toLowerCase(), password, role });
  return res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const email = String(req.body.email || '').toLowerCase();
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(req.body.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' });
  }
  return res.json({ token: signToken(user), user: publicUser(user) });
});

export const currentUser = asyncHandler(async (req, res) => res.json({ user: publicUser(req.user) }));

export const getSettings = asyncHandler(async (req, res) => {
  const { name, email, storeName, website, description, returnWindow, acceptReturns, refundPolicy } = req.user;
  res.json({ name, email, storeName, website, description, returnWindow, acceptReturns, refundPolicy });
});

export const updateSettings = asyncHandler(async (req, res) => {
  validationResultOrThrow(validationResult(req));
  const allowed = ['name', 'storeName', 'website', 'description', 'returnWindow', 'acceptReturns', 'refundPolicy'];
  for (const key of allowed) if (req.body[key] !== undefined) req.user[key] = req.body[key];
  await req.user.save();
  const { name, email, storeName, website, description, returnWindow, acceptReturns, refundPolicy } = req.user;
  res.json({ name, email, storeName, website, description, returnWindow, acceptReturns, refundPolicy });
});
