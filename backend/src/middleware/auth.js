import { verifyToken } from "../utils/token.js";
import { query } from "../config/db.js";
import { sendError } from "../utils/response.js";

/**
 * Authentication Middleware
 * 1. Verifies signed JWT token and signature.
 * 2. Queries live database to load fresh role, bureau, and active status
 *    (preventing stale JWT claims from granting unauthorized access).
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return sendError(
        res,
        "AUTH_TOKEN_MISSING",
        "Authentication required: missing Authorization header",
        401
      );
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return sendError(
        res,
        "AUTH_TOKEN_MALFORMED",
        "Authorization header must use format: Bearer <token>",
        401
      );
    }

    const token = parts[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (tokenErr) {
      return sendError(
        res,
        tokenErr.code || "AUTH_TOKEN_INVALID",
        tokenErr.message || "Invalid authentication token",
        401
      );
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!decoded.sub || !UUID_REGEX.test(decoded.sub)) {
      return sendError(
        res,
        "USER_NOT_FOUND",
        "User account associated with this token was not found",
        401
      );
    }

    // Load fresh user state from PostgreSQL
    const userRes = await query(
      `SELECT id, email, full_name, role, bureau, is_active
       FROM users
       WHERE id = $1;`,
      [decoded.sub]
    );

    if (userRes.rows.length === 0) {
      return sendError(
        res,
        "USER_NOT_FOUND",
        "User account associated with this token was not found",
        401
      );
    }

    const dbUser = userRes.rows[0];

    if (!dbUser.is_active) {
      return sendError(
        res,
        "ACCOUNT_DISABLED",
        "User account is inactive. Please contact an administrator",
        401
      );
    }

    // Attach verified user context to request
    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      full_name: dbUser.full_name,
      role: dbUser.role,
      bureau: dbUser.bureau
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
