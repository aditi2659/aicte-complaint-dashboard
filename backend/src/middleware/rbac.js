import { sendError } from "../utils/response.js";

/**
 * Deny-by-default role authorization middleware.
 * @param {string[]} allowedRoles - List of permitted roles for this endpoint
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        "FORBIDDEN_ROLE",
        `Role '${req.user.role}' is not authorized to perform this action`,
        403
      );
    }

    return next();
  };
}

/**
 * Enforces read-only restrictions on the AUDITOR role.
 * Prohibits any HTTP mutation verb (POST, PUT, PATCH, DELETE).
 */
export function enforceAuditorReadOnly(req, res, next) {
  if (req.user && req.user.role === "AUDITOR") {
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase());
    if (isMutation) {
      return sendError(
        res,
        "AUDITOR_READ_ONLY",
        "Auditors have read-only access and cannot create or modify records",
        403
      );
    }
  }
  return next();
}
