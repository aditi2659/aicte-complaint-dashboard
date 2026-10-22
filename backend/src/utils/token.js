import jwt from "jsonwebtoken";

const ISSUER = "aicte-complaint-monitoring";
const AUDIENCE = "aicte-internal-officials";
const MIN_SECRET_LENGTH = 32;

/**
 * Validates and retrieves the JWT secret from environment.
 * Enforces minimum 32 characters (256 bits) of entropy and never uses a default fallback.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured in backend/.env. Application cannot generate or verify tokens.");
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is insecure: length is ${secret.length} characters, but a minimum of ${MIN_SECRET_LENGTH} characters is required.`
    );
  }
  return secret;
}

/**
 * Generates a signed JWT with standard claims and algorithm pinning to HS256.
 */
export function generateToken(user, options = {}) {
  const secret = getJwtSecret();
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || "8h";

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    bureau: user.bureau || null,
    name: user.full_name
  };

  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn,
    issuer: ISSUER,
    audience: AUDIENCE
  });
}

/**
 * Verifies a JWT token with pinned HS256 algorithm, issuer, and audience validation.
 */
export function verifyToken(token) {
  const secret = getJwtSecret();

  try {
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      const error = new Error("Authentication token has expired. Please log in again.");
      error.code = "AUTH_TOKEN_EXPIRED";
      error.statusCode = 401;
      throw error;
    }
    const error = new Error("Authentication token is invalid.");
    error.code = "AUTH_TOKEN_INVALID";
    error.statusCode = 401;
    throw error;
  }
}
