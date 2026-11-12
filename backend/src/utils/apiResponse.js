export function sendError(res, status, message, details) {
  const body = { message };
  if (details && process.env.NODE_ENV !== 'production') body.details = details;
  return res.status(status).json(body);
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function validationResultOrThrow(validationResult) {
  const result = validationResult;
  if (result.isEmpty()) return;
  const error = new Error('Please correct the submitted fields.');
  error.statusCode = 400;
  error.details = result.array().map(item => ({ field: item.path, message: item.msg }));
  throw error;
}
