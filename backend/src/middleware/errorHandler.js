import { sendError } from "../utils/response.js";

/**
 * Global Error Handling Middleware
 */
export function errorHandler(err, _req, res, _next) {
  // Log error safely on server side
  console.error("API Error:", {
    name: err.name,
    message: err.message,
    code: err.code || "INTERNAL_ERROR",
    statusCode: err.statusCode || 500
  });

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");
  const errorMessage = statusCode >= 500
    ? "An unexpected internal server error occurred"
    : err.message;

  return sendError(res, errorCode, errorMessage, statusCode, err.details || null);
}

/**
 * 404 Not Found Middleware for unmapped routes
 */
export function notFoundHandler(req, res) {
  return sendError(
    res,
    "RESOURCE_NOT_FOUND",
    `Cannot ${req.method} ${req.originalUrl}`,
    404
  );
}
