import * as auditService from "../services/auditService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * GET /api/v1/audit-logs
 * Retrieves paginated audit logs with optional filters and bureau-level authorization.
 */
export async function list(req, res, next) {
  try {
    const { data, meta } = await auditService.listAuditLogs(req.query, req.user);
    return sendSuccess(res, data, meta);
  } catch (error) {
    if (error.code === "FORBIDDEN_BUREAU_ACCESS" || error.code === "FORBIDDEN_ROLE") {
      return sendError(res, error.code, error.message, 403);
    }
    if (error.code === "UNAUTHORIZED") {
      return sendError(res, error.code, error.message, 401);
    }
    if (error.code === "INVALID_INPUT") {
      return sendError(res, error.code, error.message, 400);
    }
    return next(error);
  }
}
