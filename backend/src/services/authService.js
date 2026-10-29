import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { query } from "../config/db.js";
import { generateToken } from "../utils/token.js";

// Pre-computed dummy hash to mitigate username enumeration via timing analysis
const DUMMY_HASH = "$2b$12$e8Y5HqGz8i6V3rZc.J9xhe0aXp7w7L6qB4fK9mY3oJ2tO1pL5uG3a";
const BCRYPT_WORK_FACTOR = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const ALLOWED_ROLES = ["SUPER_ADMIN", "BUREAU_HEAD", "BUREAU_OFFICER", "GRIEVANCE_OFFICER", "AUDITOR"];

/**
 * Validates password complexity against enterprise security standards.
 * Minimum 8 characters, at least one letter, and at least one number or symbol.
 */
export function validatePassword(password) {
  if (!password || typeof password !== "string") {
    const err = new Error("Password must be a non-empty string.");
    err.code = "INVALID_PASSWORD";
    err.statusCode = 400;
    throw err;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    err.code = "PASSWORD_TOO_SHORT";
    err.statusCode = 400;
    throw err;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    const err = new Error(`Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`);
    err.code = "PASSWORD_TOO_LONG";
    err.statusCode = 400;
    throw err;
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasLetter || !hasDigitOrSpecial) {
    const err = new Error("Password must contain at least one letter and at least one number or special character.");
    err.code = "PASSWORD_TOO_WEAK";
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Computes a SHA-256 digest of setup tokens so raw tokens are never stored in plaintext.
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates an authorized setup/activation token for a specific user.
 */
export async function createSetupToken(userId, options = {}) {
  const { tokenType = "ACCOUNT_SETUP", expiresInHours = 24, createdBy = null } = options;
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await query(
    `INSERT INTO user_setup_tokens (user_id, token_hash, token_type, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5);`,
    [userId, tokenHash, tokenType, expiresAt, createdBy]
  );

  return { token: rawToken, expiresAt };
}

/**
 * Verifies credentials, checks active status, and returns signed JWT with user profile.
 */
export async function login(email, password) {
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    const error = new Error("Email and password are required.");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, email, password_hash, full_name, role, bureau, is_active
     FROM users
     WHERE LOWER(email) = $1;`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    // Run dummy bcrypt check to equalize response time
    await bcrypt.compare(password, DUMMY_HASH);
    const error = new Error("Invalid email or password.");
    error.code = "INVALID_CREDENTIALS";
    error.statusCode = 401;
    throw error;
  }

  const user = userRes.rows[0];

  if (!user.is_active) {
    const error = new Error("User account is inactive. Please contact an administrator.");
    error.code = "ACCOUNT_DISABLED";
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const error = new Error("Invalid email or password.");
    error.code = "INVALID_CREDENTIALS";
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user);

  return {
    token,
    token_type: "Bearer",
    expires_in: 28800,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      bureau: user.bureau
    }
  };
}

/**
 * Securely establishes or updates an authorized user's password using a valid setup token.
 * Prevents unauthorized public signups and enforces that role/bureau remain admin-controlled.
 */
export async function setupPassword({ email, token, newPassword }) {
  if (!email || typeof email !== "string" || !token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
    const error = new Error("Email, setup token, and new password are required.");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  validatePassword(newPassword);

  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, email, full_name, role, bureau, is_active
     FROM users
     WHERE LOWER(email) = $1;`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    // Equalize timing to prevent enumeration
    await bcrypt.compare(newPassword, DUMMY_HASH);
    const error = new Error("Invalid email or setup token.");
    error.code = "INVALID_TOKEN";
    error.statusCode = 400;
    throw error;
  }

  const user = userRes.rows[0];

  if (!user.is_active) {
    const error = new Error("User account is inactive. Please contact an administrator.");
    error.code = "ACCOUNT_DISABLED";
    error.statusCode = 401;
    throw error;
  }

  const providedTokenHash = hashToken(token.trim());
  const tokenRes = await query(
    `SELECT id, expires_at, used_at
     FROM user_setup_tokens
     WHERE user_id = $1 AND token_hash = $2
     ORDER BY created_at DESC
     LIMIT 1;`,
    [user.id, providedTokenHash]
  );

  let isTokenValid = false;
  let setupTokenRecordId = null;

  if (tokenRes.rows.length > 0) {
    const tokenRecord = tokenRes.rows[0];
    if (tokenRecord.used_at) {
      const error = new Error("This setup token has already been used.");
      error.code = "TOKEN_ALREADY_USED";
      error.statusCode = 400;
      throw error;
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      const error = new Error("Setup token has expired. Please request a new setup link.");
      error.code = "TOKEN_EXPIRED";
      error.statusCode = 400;
      throw error;
    }
    isTokenValid = true;
    setupTokenRecordId = tokenRecord.id;
  } else {
    // Check separate bootstrap setup credential (Req 6)
    const bootstrapSecret = process.env.BOOTSTRAP_SETUP_SECRET?.trim();
    if (bootstrapSecret && bootstrapSecret.length >= 8 && token.trim() === bootstrapSecret) {
      isTokenValid = true;
    }
  }

  if (!isTokenValid) {
    const error = new Error("Invalid or expired setup token.");
    error.code = "INVALID_TOKEN";
    error.statusCode = 400;
    throw error;
  }

  // Hash new password using bcrypt with work factor 12
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_WORK_FACTOR);

  // Atomically update user's password; preserve role and bureau unchanged
  await query(
    `UPDATE users
     SET password_hash = $1, updated_at = NOW()
     WHERE id = $2;`,
    [newPasswordHash, user.id]
  );

  if (setupTokenRecordId) {
    await query(
      `UPDATE user_setup_tokens
       SET used_at = NOW()
       WHERE id = $1;`,
      [setupTokenRecordId]
    );
  }

  const jwtToken = generateToken(user);

  return {
    success: true,
    message: "Password configured successfully.",
    token: jwtToken,
    token_type: "Bearer",
    expires_in: 28800,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      bureau: user.bureau
    }
  };
}

/**
 * Requests an account setup token for an authorized email.
 */
export async function requestSetupToken(email) {
  if (!email || typeof email !== "string") {
    const error = new Error("Email is required.");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRes = await query(
    `SELECT id, email, full_name, is_active FROM users WHERE LOWER(email) = $1;`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
    return {
      message: "If an authorized account is associated with this email, setup instructions have been generated."
    };
  }

  const user = userRes.rows[0];
  const { token, expiresAt } = await createSetupToken(user.id, {
    tokenType: "ACCOUNT_SETUP",
    expiresInHours: 24
  });

  const isDevOrTest = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  return {
    message: "If an authorized account is associated with this email, setup instructions have been generated.",
    ...(isDevOrTest ? { setupToken: token, expiresAt } : {})
  };
}

/**
 * Administrator creates a new authorized official with designated role and bureau.
 * Generates an account setup token for the invited user.
 */
export async function adminCreateUser({ email, fullName, role, bureau, adminUserId }) {
  if (!email || typeof email !== "string" || !fullName || typeof fullName !== "string" || !role || typeof role !== "string") {
    const error = new Error("Email, full name, and role are required.");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanRole = role.trim().toUpperCase();

  if (!ALLOWED_ROLES.includes(cleanRole)) {
    const error = new Error(`Invalid role '${role}'. Allowed roles: ${ALLOWED_ROLES.join(", ")}`);
    error.code = "INVALID_ROLE";
    error.statusCode = 400;
    throw error;
  }

  if ((cleanRole === "BUREAU_HEAD" || cleanRole === "BUREAU_OFFICER") && !bureau) {
    const error = new Error(`Bureau assignment is required for role '${cleanRole}'.`);
    error.code = "MISSING_BUREAU";
    error.statusCode = 400;
    throw error;
  }

  const existing = await query("SELECT id FROM users WHERE LOWER(email) = $1;", [normalizedEmail]);
  if (existing.rows.length > 0) {
    const error = new Error(`User with email '${normalizedEmail}' already exists.`);
    error.code = "DUPLICATE_USER";
    error.statusCode = 409;
    throw error;
  }

  // Pre-seed with locked account hash until the official activates via token
  const lockedHash = `$2b$12$LOCKED_ACCOUNT_${crypto.randomBytes(16).toString("hex")}`;

  const insertRes = await query(
    `INSERT INTO users (email, password_hash, full_name, role, bureau, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, email, full_name, role, bureau, is_active, created_at;`,
    [normalizedEmail, lockedHash, fullName.trim(), cleanRole, bureau?.trim() || null]
  );

  const newUser = insertRes.rows[0];
  const { token, expiresAt } = await createSetupToken(newUser.id, {
    tokenType: "ACCOUNT_SETUP",
    expiresInHours: 48,
    createdBy: adminUserId
  });

  return {
    user: newUser,
    setupToken: token,
    expiresAt
  };
}

/**
 * Administrator generates a password setup token for an existing user.
 */
export async function adminGenerateSetupToken({ email, adminUserId }) {
  if (!email || typeof email !== "string") {
    const error = new Error("Email is required.");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userRes = await query(
    `SELECT id, email, full_name, role, bureau, is_active FROM users WHERE LOWER(email) = $1;`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    const error = new Error(`User '${normalizedEmail}' not found.`);
    error.code = "USER_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }

  const user = userRes.rows[0];
  const { token, expiresAt } = await createSetupToken(user.id, {
    tokenType: "ACCOUNT_SETUP",
    expiresInHours: 48,
    createdBy: adminUserId
  });

  return {
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    bureau: user.bureau,
    setupToken: token,
    expiresAt
  };
}

/**
 * Retrieves current authenticated user profile.
 */
export async function getProfile(userId) {
  const result = await query(
    `SELECT id, email, full_name, role, bureau, is_active, created_at
     FROM users
     WHERE id = $1;`,
    [userId]
  );

  return result.rows[0] || null;
}
