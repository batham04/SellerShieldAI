import mongoose from 'mongoose';
import { sendError } from '../utils/apiResponse.js';

export function notFound(req, res) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return;
  if (error instanceof mongoose.Error.ValidationError) {
    return sendError(res, 400, 'Validation failed.', Object.values(error.errors).map(item => item.message));
  }
  if (error instanceof mongoose.Error.CastError) return sendError(res, 400, 'The supplied identifier is invalid.');
  if (error.code === 11000) return sendError(res, 409, 'A record with that value already exists.');
  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error('Request failed:', { method: req.method, path: req.path, message: error.message });
  return sendError(res, status, status >= 500 && process.env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : error.message || 'An unexpected server error occurred.', error.details);
}
