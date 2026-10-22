/**
 * Frontend Service Verification Script
 * Validates frontend API client operations, session management,
 * token injection, error handling, and 401 invalidation against the live backend.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../backend/.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

// Minimal Mock sessionStorage for Node runtime
class MockSessionStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.sessionStorage = new MockSessionStorage();

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

async function runVerification() {
  console.log("=== Frontend API Integration Verification ===\n");

  const {
    login,
    getCurrentUser,
    getDashboardSummary,
    getComplaints,
    getInstitutions,
    getOverlaps,
    clearSession,
    getStoredToken,
    getStoredUser,
    setUnauthorizedHandler,
    checkHealth
  } = await import("./src/services/api.js");

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error("FATAL: BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_STAFF_PASSWORD required in backend/.env");
    process.exit(1);
  }

  // 1. Health Probe
  console.log("--- 1. Health Probe ---");
  const healthRes = await checkHealth();
  assert(healthRes.status === "ok", "checkHealth() connects to /api/health");

  // 2. Failed Login Validation
  console.log("\n--- 2. Negative Login Handling ---");
  let badLoginCaught = false;
  try {
    await login("admin@aicte.gov.in", "WrongPassword999!");
  } catch (err) {
    badLoginCaught = true;
    assert(err.status === 401, "login() throws error with status 401 for bad password");
    assert(err.message === "Invalid email or password.", "login() surfaces clean error message without leaking sensitive data");
  }
  assert(badLoginCaught, "Invalid login attempt correctly rejected");

  // 3. Successful Login & Session Storage
  console.log("\n--- 3. Successful Login & Session Storage ---");
  clearSession();
  assert(getStoredToken() === null, "Session is clean before login");

  const authData = await login("admin@aicte.gov.in", adminPassword);
  assert(authData.token && typeof authData.token === "string", "login() returns valid token");
  assert(authData.user.role === "SUPER_ADMIN", "login() returns user profile with role SUPER_ADMIN");
  assert(getStoredToken() === authData.token, "Token automatically persisted in sessionStorage");
  assert(getStoredUser().email === "admin@aicte.gov.in", "User profile automatically persisted in sessionStorage");

  // 4. Authenticated Profile Fetch
  console.log("\n--- 4. Authenticated Profile Fetch ---");
  const profile = await getCurrentUser();
  assert(profile.email === "admin@aicte.gov.in", "getCurrentUser() retrieves identity via Bearer token");
  assert(profile.role === "SUPER_ADMIN", "getCurrentUser() returns role SUPER_ADMIN");

  // 5. Dashboard Summary Metrics
  console.log("\n--- 5. Dashboard Summary Endpoint ---");
  const summary = await getDashboardSummary();
  assert(summary.total_complaints === 5, "getDashboardSummary() returns total_complaints = 5");
  assert(summary.overlaps?.total === 2, "getDashboardSummary() returns overlaps.total = 2");
  assert(typeof summary.by_status === "object", "getDashboardSummary() includes by_status distribution");

  // 6. Complaints List & Pagination
  console.log("\n--- 6. Complaints Registry Endpoint ---");
  const complaintsRes = await getComplaints({ limit: 10 });
  assert(Array.isArray(complaintsRes.complaints) && complaintsRes.complaints.length === 5, "getComplaints() returns 5 complaints");
  assert(complaintsRes.meta.total === 5, "getComplaints() includes pagination metadata");
  assert(complaintsRes.complaints.some(c => (c.complaint_id || c.id) === "CMP-1001"), "getComplaints() maps complaint records correctly (includes CMP-1001)");

  // 7. Institutions Directory Endpoint
  console.log("\n--- 7. Institutions Directory Endpoint ---");
  const institutionsRes = await getInstitutions();
  assert(Array.isArray(institutionsRes.institutions) && institutionsRes.institutions.length === 2, "getInstitutions() returns 2 institutions");
  assert(institutionsRes.institutions[0].aicte_permanent_id === "INST-204", "getInstitutions() maps institution records correctly");

  // 8. Overlaps Feed Endpoint
  console.log("\n--- 8. Overlaps Feed Endpoint ---");
  const overlapsRes = await getOverlaps();
  assert(Array.isArray(overlapsRes.overlaps) && overlapsRes.overlaps.length === 2, "getOverlaps() returns 2 overlap links");
  assert(overlapsRes.overlaps[0].caseA && overlapsRes.overlaps[0].caseB, "getOverlaps() includes caseA and caseB objects");
  assert(overlapsRes.overlaps[0].similarity_score > 0.6, "getOverlaps() includes similarity_score");

  // 9. Bureau-Scoped Officer Session Verification
  console.log("\n--- 9. Bureau-Scoped Officer Session & Data Isolation ---");
  clearSession();
  const sdcAuth = await login("sdc.officer@aicte.gov.in", staffPassword);
  assert(sdcAuth.user.role === "BUREAU_OFFICER" && sdcAuth.user.bureau === "Student Development Cell", "SDC Officer logged in successfully");

  const sdcSummary = await getDashboardSummary();
  assert(sdcSummary.total_complaints === 2, "SDC Officer summary total_complaints equals 2 (bureau-scoped)");

  const sdcComplaints = await getComplaints();
  assert(sdcComplaints.complaints.length === 2 && sdcComplaints.complaints.every(c => c.bureau === "Student Development Cell"), "SDC Officer complaints strictly filtered to Student Development Cell");

  // 10. Auditor Session Verification
  console.log("\n--- 10. Auditor Session Verification ---");
  clearSession();
  const auditorAuth = await login("auditor@aicte.gov.in", staffPassword);
  assert(auditorAuth.user.role === "AUDITOR", "Auditor logged in successfully");

  const auditorSummary = await getDashboardSummary();
  assert(auditorSummary.total_complaints === 5, "Auditor summary reads system-wide (5 complaints)");

  // 11. 401 Session Invalidation & Unauthorized Handler
  console.log("\n--- 11. 401 Expiration & Session Purge ---");
  let unauthorizedFired = false;
  setUnauthorizedHandler(() => {
    unauthorizedFired = true;
  });

  // Inject invalid token to simulate expired session
  sessionStorage.setItem("aicte_auth_token", "invalid.or.expired.jwt.token");
  let caught401 = false;
  try {
    await getCurrentUser();
  } catch (err) {
    caught401 = true;
    assert(err.status === 401, "Invalid/expired token causes 401 error");
  }
  assert(caught401, "Request with invalid token rejected");
  assert(unauthorizedFired, "onUnauthorized callback invoked on 401");
  assert(getStoredToken() === null, "sessionStorage token purged on 401");

  // 12. Explicit Logout
  console.log("\n--- 12. Explicit Logout ---");
  await login("admin@aicte.gov.in", adminPassword);
  assert(getStoredToken() !== null, "Session established");
  clearSession();
  assert(getStoredToken() === null, "clearSession() purges token");
  assert(getStoredUser() === null, "clearSession() purges user profile");

  console.log("\n========================================");
  console.log(`Frontend Verification: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) process.exit(1);
}

runVerification().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
