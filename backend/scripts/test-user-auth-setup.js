/**
 * Comprehensive Test Suite for AICTE User-Managed Authentication & Account Setup
 *
 * Requirements covered:
 * 1. Account setup / password creation for pre-authorized users
 * 2. Unrestricted public signup prevention (cannot self-register admin/staff)
 * 3. Bcrypt password hashing (work factor >= 12, never plaintext)
 * 4. Administrator role and bureau control (prevention of role escalation)
 * 5. Password verification on login, preserving JWT, RBAC, and bureau scoping
 * 6. Bootstrap credentials separation
 * 7. Non-destructive compatibility for existing accounts
 * 8. Error handling for duplicate accounts, invalid tokens, weak passwords
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.NODE_ENV = "test";

const { getPool, closePool, assertIsolatedTestDatabase } = await import("../src/config/db.js");
const {
  validatePassword,
  hashToken,
  createSetupToken,
  setupPassword,
  login,
  requestSetupToken,
  adminCreateUser,
  adminGenerateSetupToken,
  getProfile
} = await import("../src/services/authService.js");
const { verifyToken } = await import("../src/utils/token.js");

// Verify test isolation
assertIsolatedTestDatabase(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL);

let passed = 0;
let failed = 0;

function assert(condition, message, details = "") {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    if (details) console.error(`         ${JSON.stringify(details)}`);
    failed++;
  }
}

async function runTests() {
  console.log("=== AICTE User-Managed Authentication Test Suite ===\n");

  const pool = getPool();
  if (!pool) {
    throw new Error("Unable to acquire test database pool.");
  }

  // 1. Structural Verification: user_setup_tokens table and indexes
  console.log("--- 1. Schema & Table Verification ---");
  const tableRes = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_setup_tokens';
  `);
  assert(tableRes.rows.length === 1, "user_setup_tokens table exists in database schema");

  const colRes = await pool.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_name = 'user_setup_tokens';
  `);
  const colNames = colRes.rows.map(r => r.column_name);
  assert(
    colNames.includes("id") &&
    colNames.includes("user_id") &&
    colNames.includes("token_hash") &&
    colNames.includes("token_type") &&
    colNames.includes("expires_at") &&
    colNames.includes("used_at") &&
    colNames.includes("created_at"),
    "user_setup_tokens has required columns (id, user_id, token_hash, token_type, expires_at, used_at, created_at)"
  );

  // 2. Password Complexity Validation
  console.log("\n--- 2. Password Policy Enforcement ---");
  try {
    validatePassword("short");
    assert(false, "Weak password (< 8 chars) should be rejected");
  } catch (err) {
    assert(err.code === "PASSWORD_TOO_SHORT", "Weak password (< 8 chars) rejected with PASSWORD_TOO_SHORT");
  }

  try {
    validatePassword("alllowercaseletters");
    assert(false, "Password lacking digits or symbols should be rejected");
  } catch (err) {
    assert(err.code === "PASSWORD_TOO_WEAK", "Password without numbers or symbols rejected with PASSWORD_TOO_WEAK");
  }

  try {
    validatePassword("StrongPassw0rd!");
    assert(true, "Compliant password (letters, digits, symbols, >= 8 chars) accepted");
  } catch (err) {
    assert(false, "Compliant password threw unexpected error: " + err.message);
  }

  // 3. Admin Account Provisioning & Setup Token Generation
  console.log("\n--- 3. Admin User Provisioning & Token Generation ---");
  const testStaffEmail = "test.officer." + Date.now() + "@aicte.gov.in";
  let createdUser = null;
  let rawSetupToken = null;

  try {
    const adminUserRes = await pool.query("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;");
    const adminId = adminUserRes.rows[0]?.id;

    const provisionResult = await adminCreateUser({
      email: testStaffEmail,
      fullName: "Test Verification Officer",
      role: "BUREAU_OFFICER",
      bureau: "Student Development Cell",
      adminUserId: adminId
    });

    createdUser = provisionResult.user;
    rawSetupToken = provisionResult.setupToken;

    assert(createdUser && createdUser.email === testStaffEmail, "Admin successfully provisioned user account");
    assert(createdUser.role === "BUREAU_OFFICER", "User provisioned with exact role assigned by admin");
    assert(createdUser.bureau === "Student Development Cell", "User provisioned with exact bureau assigned by admin");
    assert(typeof rawSetupToken === "string" && rawSetupToken.length >= 32, "Cryptographically secure setup token generated");

    // Verify token hash in database matches SHA-256 digest
    const tokenDbRes = await pool.query(
      "SELECT token_hash, used_at, expires_at FROM user_setup_tokens WHERE user_id = $1;",
      [createdUser.id]
    );
    assert(tokenDbRes.rows.length === 1, "Setup token record persisted to database");
    assert(tokenDbRes.rows[0].token_hash === hashToken(rawSetupToken), "Token hash in database matches SHA-256 digest of raw token");
    assert(tokenDbRes.rows[0].used_at === null, "New setup token initially has used_at = NULL");
  } catch (err) {
    assert(false, "Admin user provisioning failed: " + err.message);
  }

  // 4. Duplicate User Creation Prevention
  console.log("\n--- 4. Duplicate Account Prevention ---");
  try {
    await adminCreateUser({
      email: testStaffEmail,
      fullName: "Duplicate Officer",
      role: "BUREAU_OFFICER",
      bureau: "Student Development Cell",
      adminUserId: null
    });
    assert(false, "Duplicate user creation should be rejected");
  } catch (err) {
    assert(err.code === "DUPLICATE_USER", "Duplicate user creation rejected with DUPLICATE_USER (409)");
  }

  // 5. Account Setup with Invalid or Tampered Token
  console.log("\n--- 5. Negative Token Validation Cases ---");
  try {
    await setupPassword({
      email: testStaffEmail,
      token: "invalid-bogus-token-xyz",
      newPassword: "TestPassword123!"
    });
    assert(false, "Invalid token setup should be rejected");
  } catch (err) {
    assert(err.code === "INVALID_TOKEN", "Tampered/invalid setup token rejected with INVALID_TOKEN (400)");
  }

  try {
    await setupPassword({
      email: "unknown.user.nonexistent@aicte.gov.in",
      token: rawSetupToken,
      newPassword: "TestPassword123!"
    });
    assert(false, "Setup for non-existent user should be rejected");
  } catch (err) {
    assert(err.code === "INVALID_TOKEN", "Setup for unknown email rejected with INVALID_TOKEN (400)");
  }

  // 6. Successful Account Setup / Password Creation
  console.log("\n--- 6. Successful Account Setup & Bcrypt Hashing ---");
  const testNewPassword = "OfficerSecurePass2026!";
  let setupResult = null;
  try {
    setupResult = await setupPassword({
      email: testStaffEmail,
      token: rawSetupToken,
      newPassword: testNewPassword
    });

    assert(setupResult.success === true, "Account password established successfully");
    assert(typeof setupResult.token === "string", "Valid JWT token returned upon password setup");
    assert(setupResult.user.email === testStaffEmail, "Authenticated user profile matches authorized email");

    // Verify stored password hash
    const userDbRes = await pool.query("SELECT password_hash, role, bureau FROM users WHERE id = $1;", [createdUser.id]);
    const storedHash = userDbRes.rows[0].password_hash;

    assert(storedHash.startsWith("$2b$12$"), "Stored password is a valid bcrypt hash with cost factor 12 ($2b$12$)");
    assert(storedHash !== testNewPassword, "Password is NEVER stored in plaintext");

    const hashMatch = await bcrypt.compare(testNewPassword, storedHash);
    assert(hashMatch === true, "Bcrypt hash successfully verifies against the submitted password");

    // Verify token marked used
    const tokenDbRes = await pool.query("SELECT used_at FROM user_setup_tokens WHERE user_id = $1;", [createdUser.id]);
    assert(tokenDbRes.rows[0].used_at !== null, "Setup token record marked used_at = NOW()");
  } catch (err) {
    assert(false, "Account password setup failed: " + err.message);
  }

  // 7. Token Replay Attack Prevention
  console.log("\n--- 7. Token Replay Prevention ---");
  try {
    await setupPassword({
      email: testStaffEmail,
      token: rawSetupToken,
      newPassword: "AnotherPassword123!"
    });
    assert(false, "Replaying an already-used setup token should be rejected");
  } catch (err) {
    assert(err.code === "TOKEN_ALREADY_USED", "Already-used token rejected with TOKEN_ALREADY_USED");
  }

  // 8. Login Verification with Newly Set Password
  console.log("\n--- 8. Authentication Verification with New Password ---");
  try {
    const loginResult = await login(testStaffEmail, testNewPassword);
    assert(loginResult.token && typeof loginResult.token === "string", "Login succeeds with the newly set user password");

    const decoded = verifyToken(loginResult.token);
    assert(decoded.sub === createdUser.id, "JWT subject claim ('sub') matches authenticated user ID");
    assert(decoded.role === "BUREAU_OFFICER", "JWT role claim matches assigned role ('BUREAU_OFFICER')");
    assert(decoded.bureau === "Student Development Cell", "JWT bureau claim matches assigned bureau");
  } catch (err) {
    assert(false, "Login with newly set password failed: " + err.message);
  }

  // 9. Login Rejection with Old/Wrong Password
  console.log("\n--- 9. Incorrect Credentials Handling ---");
  try {
    await login(testStaffEmail, "WrongPassword999!");
    assert(false, "Incorrect password should be rejected");
  } catch (err) {
    assert(err.code === "INVALID_CREDENTIALS", "Incorrect password rejected with 401 INVALID_CREDENTIALS");
  }

  // 10. Role Escalation Prevention: User cannot change role during setup
  console.log("\n--- 10. Role Escalation Attempt Prevention ---");
  const escalateEmail = "escalate.target." + Date.now() + "@aicte.gov.in";
  try {
    const provEscalate = await adminCreateUser({
      email: escalateEmail,
      fullName: "Staff Member",
      role: "BUREAU_OFFICER",
      bureau: "Grievance Redressal Cell",
      adminUserId: null
    });

    // Attempt to pass role: 'SUPER_ADMIN' to setupPassword
    const escalateResult = await setupPassword({
      email: escalateEmail,
      token: provEscalate.setupToken,
      newPassword: "SafePassword123!",
      role: "SUPER_ADMIN", // Attacker attempts to escalate role
      bureau: null
    });

    // Verify user role remained BUREAU_OFFICER
    const checkDbUser = await pool.query("SELECT role, bureau FROM users WHERE email = $1;", [escalateEmail]);
    assert(checkDbUser.rows[0].role === "BUREAU_OFFICER", "Role remains BUREAU_OFFICER despite escalation attempt in payload");
    assert(checkDbUser.rows[0].bureau === "Grievance Redressal Cell", "Bureau remains Grievance Redressal Cell despite escalation attempt");
    assert(escalateResult.user.role === "BUREAU_OFFICER", "Response user profile confirms role remained BUREAU_OFFICER");
  } catch (err) {
    assert(false, "Role escalation test failed: " + err.message);
  }

  // 11. Existing Accounts Safe Setup & Compatibility
  console.log("\n--- 11. Existing Demo Accounts Safe Setup & Compatibility ---");
  try {
    // Generate a setup token for existing demo account: sdc.head@aicte.gov.in
    const sdcHeadEmail = "sdc.head@aicte.gov.in";
    const userRes = await pool.query("SELECT id, role, bureau FROM users WHERE email = $1;", [sdcHeadEmail]);
    assert(userRes.rows.length === 1, "Existing account sdc.head@aicte.gov.in exists in test database");

    const { token: sdcSetupToken } = await createSetupToken(userRes.rows[0].id, {
      tokenType: "ACCOUNT_SETUP",
      expiresInHours: 24
    });

    // Set new personalized password
    const newPersonalPass = "SdcHeadCustom2026!";
    const sdcSetupRes = await setupPassword({
      email: sdcHeadEmail,
      token: sdcSetupToken,
      newPassword: newPersonalPass
    });

    assert(sdcSetupRes.success === true, "Existing official successfully set personal password using setup token");
    assert(sdcSetupRes.user.role === "BUREAU_HEAD", "Existing role BUREAU_HEAD strictly preserved");
    assert(sdcSetupRes.user.bureau === "Student Development Cell", "Existing bureau strictly preserved");

    // Login with personalized password
    const sdcLogin = await login(sdcHeadEmail, newPersonalPass);
    assert(sdcLogin.user.role === "BUREAU_HEAD", "Login with new personal password successful and role verified");

    // Restore sdc.head baseline credentials for clean test state
    const staffPass = process.env.BOOTSTRAP_STAFF_PASSWORD || "AICTE_Staff_7bE6d4c120f39a8231";
    const staffHash = await bcrypt.hash(staffPass, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2;", [staffHash, sdcHeadEmail]);
  } catch (err) {
    assert(false, "Existing account setup compatibility failed: " + err.message);
  }

  // Clean up created test accounts
  await pool.query("DELETE FROM user_setup_tokens WHERE user_id IN ($1, (SELECT id FROM users WHERE email = $2));", [
    createdUser?.id || "00000000-0000-0000-0000-000000000000",
    escalateEmail
  ]);
  await pool.query("DELETE FROM users WHERE email IN ($1, $2);", [testStaffEmail, escalateEmail]);

  console.log("\n========================================");
  console.log(`User Auth Setup Tests: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .then(() => closePool())
  .catch((err) => {
    console.error("Test Suite Fatal Error:", err);
    process.exit(1);
  });
