import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/apiResponse.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication is required.' });
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
  const user = await User.findById(claims.sub);
  if (!user) return res.status(401).json({ message: 'This account is no longer available.' });
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(claims.sub);
    if (!req.user) return res.status(401).json({ message: 'This account is no longer available.' });
    return next();
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' });
  }
});
