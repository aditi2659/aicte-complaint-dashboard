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
 * POST /api/v1/auth/setup-password
 * Allows pre-authorized officials to set or reset their account password using a valid setup token.
 */
export async function setupPassword(req, res, next) {
  try {
    const { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return sendError(
        res,
        "INVALID_INPUT",
        "Fields 'email', 'token', and 'newPassword' are all required",
        400
      );
    }

    const result = await authService.setupPassword({ email, token, newPassword });
    return sendSuccess(res, result, null, 200);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/request-setup
 * Allows an authorized user to request an account setup token.
 */
export async function requestSetup(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return sendError(res, "INVALID_INPUT", "Field 'email' is required", 400);
    }

    const result = await authService.requestSetupToken(email);
    return sendSuccess(res, result, null, 200);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/admin/users
 * SUPER_ADMIN creates a new authorized official with designated role and bureau.
 */
export async function adminCreateUser(req, res, next) {
  try {
    const { email, fullName, role, bureau } = req.body || {};
    if (!email || !fullName || !role) {
      return sendError(
        res,
        "INVALID_INPUT",
        "Fields 'email', 'fullName', and 'role' are required",
        400
      );
    }

    const result = await authService.adminCreateUser({
      email,
      fullName,
      role,
      bureau,
      adminUserId: req.user.id
    });

    return sendSuccess(res, result, null, 201);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/auth/admin/generate-setup-token
 * SUPER_ADMIN generates an activation / password setup token for an existing user.
 */
export async function adminGenerateSetupToken(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return sendError(res, "INVALID_INPUT", "Field 'email' is required", 400);
    }

    const result = await authService.adminGenerateSetupToken({
      email,
      adminUserId: req.user.id
    });

    return sendSuccess(res, result, null, 200);
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
