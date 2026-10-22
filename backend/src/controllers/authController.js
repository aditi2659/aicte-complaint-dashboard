import * as authService from "../services/authService.js";
import { sendSuccess, sendError } from "../utils/response.js";

/**
 * POST /api/v1/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return sendError(
        res,
        "INVALID_INPUT",
        "Both 'email' and 'password' are required fields",
        400
      );
    }

    const authData = await authService.login(email, password);
    return sendSuccess(res, authData, null, 200);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function me(req, res, next) {
  try {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    }
    return sendSuccess(res, req.user);
  } catch (error) {
    return next(error);
  }
}
