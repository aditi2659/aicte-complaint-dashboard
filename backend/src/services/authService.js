import bcrypt from "bcrypt";
import { query } from "../config/db.js";
import { generateToken } from "../utils/token.js";

// Pre-computed dummy hash to mitigate username enumeration via timing analysis
const DUMMY_HASH = "$2b$12$e8Y5HqGz8i6V3rZc.J9xhe0aXp7w7L6qB4fK9mY3oJ2tO1pL5uG3a";

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
