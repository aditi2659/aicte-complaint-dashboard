/**
 * Operator CLI Tool: Generate Account Setup / Password Activation Token
 *
 * Usage:
 *   node scripts/generate-setup-token.js --email <official-email> [--hours <expiration-hours>]
 *
 * Generates a secure, cryptographically random activation token, computes its SHA-256
 * digest, and stores the digest in `user_setup_tokens`. Prints only the one-time raw token
 * to stdout for out-of-band transmission to the authorized official.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.resolve(backendRoot, "../.env") });

const { getPool, closePool } = await import("../src/config/db.js");
const { createSetupToken } = await import("../src/services/authService.js");

async function main() {
  const emailIdx = process.argv.indexOf("--email");
  const email = emailIdx !== -1 ? process.argv[emailIdx + 1]?.trim().toLowerCase() : null;

  const hoursIdx = process.argv.indexOf("--hours");
  const hours = hoursIdx !== -1 ? parseInt(process.argv[hoursIdx + 1], 10) : 48;

  if (!email) {
    console.error("Error: --email <email> is required.");
    console.error("Usage: node scripts/generate-setup-token.js --email admin@aicte.gov.in [--hours 48]");
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) {
    console.error("Error: Unable to connect to database. Ensure DATABASE_URL is set in backend/.env.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const userRes = await client.query(
      `SELECT id, email, full_name, role, bureau, is_active FROM users WHERE LOWER(email) = $1;`,
      [email]
    );

    if (userRes.rows.length === 0) {
      console.error(`Error: User with email '${email}' was not found in database.`);
      process.exit(1);
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      console.error(`Error: User account '${email}' is currently inactive.`);
      process.exit(1);
    }

    const { token, expiresAt } = await createSetupToken(user.id, {
      tokenType: "ACCOUNT_SETUP",
      expiresInHours: hours
    });

    console.log("\n=======================================================");
    console.log("   AICTE SECURE ACCOUNT SETUP TOKEN GENERATED");
    console.log("=======================================================");
    console.log(`Email:       ${user.email}`);
    console.log(`Name:        ${user.full_name}`);
    console.log(`Role:        ${user.role}`);
    console.log(`Bureau:      ${user.bureau || "None"}`);
    console.log(`Expires At:  ${expiresAt.toISOString()}`);
    console.log("-------------------------------------------------------");
    console.log(`SETUP TOKEN: ${token}`);
    console.log("=======================================================\n");
    console.log("Note: Provide this token to the authorized user to establish their password via the portal.");
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((err) => {
  console.error("Execution Error:", err.message);
  process.exit(1);
});
