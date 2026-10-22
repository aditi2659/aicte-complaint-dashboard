/**
 * Standardized API Response Utilities
 */

export function sendSuccess(res, data, meta = null, statusCode = 200) {
  const payload = {
    success: true,
    data
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

export function sendError(res, code, message, statusCode = 500, details = null) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}
