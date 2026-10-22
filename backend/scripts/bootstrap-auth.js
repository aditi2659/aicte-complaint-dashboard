import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
dotenv.config({ path: path.resolve(backendRoot, "../.env") });

const { getPool } = await import("../src/config/db.js");

const BCRYPT_ROUNDS = 12;

// Demo accounts specification
const DEMO_ACCOUNTS = [
  {
    email: "admin@aicte.gov.in",
    full_name: "AICTE Central Administrator",
    role: "SUPER_ADMIN",
    bureau: null,
    isStaff: false
  },
  {
    email: "sdc.head@aicte.gov.in",
    full_name: "Student Development Bureau Head",
    role: "BUREAU_HEAD",
    bureau: "Student Development Cell",
    isStaff: true
  },
  {
    email: "sdc.officer@aicte.gov.in",
    full_name: "Student Development Cell Officer",
    role: "BUREAU_OFFICER",
    bureau: "Student Development Cell",
    isStaff: true
  },
  {
    email: "grc.officer@aicte.gov.in",
    full_name: "Grievance Redressal Officer",
    role: "BUREAU_OFFICER",
    bureau: "Grievance Redressal Cell",
    isStaff: true
  },
  {
    email: "grievance.officer@aicte.gov.in",
    full_name: "Central Grievance Redressal Officer",
    role: "GRIEVANCE_OFFICER",
    bureau: "Grievance Redressal Cell",
    isStaff: true
  },
  {
    email: "qac.officer@aicte.gov.in",
    full_name: "Quality Assurance Officer",
    role: "BUREAU_OFFICER",
    bureau: "Quality Assurance Cell",
    isStaff: true
  },
  {
    email: "auditor@aicte.gov.in",
    full_name: "Central Compliance Auditor",
    role: "AUDITOR",
    bureau: null,
    isStaff: true
  }
];

/**
 * Prompts for a password without echoing characters to the terminal.
 * Uses native libuv raw mode to disable operating system terminal echo cross-platform
 * (Windows PowerShell, Windows CMD, Linux, macOS).
 * Preserves password characters exactly as entered without trimming.
 * Safely restores terminal raw mode in every exit path (Enter, Backspace, Ctrl+C, EOF, Error, Exception).
 */
function promptPassword(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      resolve(null);
      return;
    }

    process.stdout.write(promptText);

    let password = "";
    const wasRaw = Boolean(process.stdin.isRaw);

    function cleanup() {
      process.stdin.removeListener("data", onData);
      process.stdin.removeListener("error", onError);
      process.stdin.removeListener("end", onEnd);
      process.removeListener("SIGINT", onSigint);
      if (typeof process.stdin.setRawMode === "function") {
        try {
          process.stdin.setRawMode(wasRaw);
        } catch (_) {}
      }
      process.stdin.pause();
    }

    function onSigint() {
      cleanup();
      process.stdout.write("\nAuthentication bootstrap cancelled by user.\n");
      process.exit(130);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function onEnd() {
      cleanup();
      process.stdout.write("\n");
      resolve(password.length > 0 ? password : null);
    }

    function onData(chunk) {
      const str = chunk.toString("utf8");
      for (const char of str) {
        if (char === "\r" || char === "\n") {
          // Enter: submission
          cleanup();
          process.stdout.write("\n");
          resolve(password.length > 0 ? password : null);
          return;
        } else if (char === "\u0004") {
          // Ctrl+D (EOF)
          cleanup();
          process.stdout.write("\n");
          resolve(password.length > 0 ? password : null);
          return;
        } else if (char === "\u0003") {
          // Ctrl+C in raw mode
          onSigint();
          return;
        } else if (char === "\b" || char === "\x7f") {
          // Backspace / Delete
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else if (char >= " " || char === "\t") {
          // Printable characters and tab: preserved verbatim
          password += char;
        }
      }
    }

    process.once("SIGINT", onSigint);

    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", onData);
      process.stdin.once("error", onError);
      process.stdin.once("end", onEnd);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

/**
 * Resolves a password securely without logging or printing secrets:
 * 1. Checks configured environment variable in backend/.env (preserves exact value).
 * 2. Prompts interactively with non-echoing input if running in a TTY (preserves exact value).
 * 3. In non-interactive mode with missing env, fails cleanly with instructions.
 */
async function resolvePassword(envVarName, accountLabel) {
  const envVal = process.env[envVarName];
  if (envVal !== undefined && envVal !== "") {
    return envVal;
  }

  const interactivePassword = await promptPassword(
    `Enter password for ${accountLabel} (${envVarName} unset in .env): `
  );
  if (interactivePassword !== null && interactivePassword !== "") {
    return interactivePassword;
  }

  throw new Error(
    `Password resolution failed for ${accountLabel}.\n` +
    `Please set ${envVarName} in backend/.env or run bootstrap in an interactive terminal.\n` +
    `Automatic logging or printing of credentials to stdout is disabled for security.`
  );
}

/**
 * Master account bootstrap routine.
 * Provisions demo users in the database with bcrypt hashes.
 * Note: Login endpoints, JWT tokens, and RBAC middleware are Phase 6 deliverables.
 */
export async function bootstrapAuth() {
  const pool = getPool();
  if (!pool) {
    throw new Error("Cannot bootstrap accounts: DATABASE_URL is not configured.");
  }

  const client = await pool.connect();

  try {
    const isReset = process.argv.includes("--reset-password");
    const targetEmailIndex = process.argv.indexOf("--email");
    const targetEmail = targetEmailIndex !== -1 ? process.argv[targetEmailIndex + 1]?.toLowerCase() : null;

    if (isReset && !targetEmail) {
      throw new Error("Usage: node scripts/bootstrap-auth.js --reset-password --email <user-email>");
    }

    console.log("Starting authentication bootstrap...");
    console.log("Note: This script provisions users in the database; login APIs and RBAC middleware are Phase 6.");

    // Resolve passwords without echoing, logging, or trimming
    const adminPassword = await resolvePassword("BOOTSTRAP_ADMIN_PASSWORD", "Central Administrator");
    const staffPassword = await resolvePassword("BOOTSTRAP_STAFF_PASSWORD", "Bureau Staff Accounts");

    const adminHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const staffHash = await bcrypt.hash(staffPassword, BCRYPT_ROUNDS);

    for (const acc of DEMO_ACCOUNTS) {
      if (isReset && acc.email.toLowerCase() !== targetEmail) {
        continue;
      }

      const existingRes = await client.query("SELECT id FROM users WHERE email = $1;", [acc.email]);
      const passwordHash = acc.isStaff ? staffHash : adminHash;

      if (existingRes.rows.length > 0) {
        if (isReset) {
          await client.query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2;", [
            passwordHash,
            acc.email
          ]);
          console.log(`- Password reset successfully for existing account: ${acc.email}`);
        } else {
          console.log(`- Account ${acc.email} already exists; preserving existing credentials (skipping).`);
        }
      } else {
        await client.query(
          `INSERT INTO users (email, password_hash, full_name, role, bureau, is_active)
           VALUES ($1, $2, $3, $4, $5, TRUE);`,
          [acc.email, passwordHash, acc.full_name, acc.role, acc.bureau]
        );
        console.log(`+ Provisioned demo account: ${acc.email} (${acc.role}${acc.bureau ? ` - ${acc.bureau}` : ""})`);
      }
    }

    console.log("Authentication bootstrap completed.");
  } finally {
    client.release();
  }
}

// Allow direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  bootstrapAuth()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Auth Bootstrap Error:", err.message);
      process.exit(1);
    });
}
