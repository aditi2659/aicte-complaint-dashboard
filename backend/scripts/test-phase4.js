/**
 * Phase 4 Comprehensive Verification Test Runner
 * Tests JWT authentication, token validation, expiration, error codes,
 * startup validation, and database-level bureau scoping across all five roles.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.NODE_ENV = process.env.NODE_ENV || "test";

import { generateToken, verifyToken, getJwtSecret } from "../src/utils/token.js";
import { listComplaints, getComplaintById, getLegacyComplaints } from "../src/services/complaintService.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import { listOverlaps, getRelatedByComplaintId } from "../src/services/overlapService.js";
import { getInstitutionComplaints } from "../src/services/institutionService.js";
import { enforceAuditorReadOnly, authorizeRoles } from "../src/middleware/rbac.js";
import { closePool } from "../src/config/db.js";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:4000";

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

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, options);
  let body;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { status: response.status, body };
}

async function runTests() {
  console.log("=== AICTE Dashboard Phase 4 Security Verification Suite ===\n");

  // 1. Secret & Token Utility Verification
  console.log("--- 1. Secret & Token Utility Integrity ---");
  const secret = getJwtSecret();
  assert(typeof secret === "string" && secret.length >= 32, "JWT_SECRET has >= 32 characters of entropy");

  const validToken = generateToken({
    id: "a0000000-0000-0000-0000-000000000001",
    email: "test@aicte.gov.in",
    role: "SUPER_ADMIN",
    bureau: null,
    full_name: "Test Administrator"
  });
  const decoded = verifyToken(validToken);
  assert(decoded.email === "test@aicte.gov.in" && decoded.role === "SUPER_ADMIN", "Token generated and verified with pinned HS256");

  // 1.1 Startup Validation in Isolated Child Processes (Non-destructive to real .env)
  console.log("\n--- 1.1 Isolated Startup Secret Validation Checks ---");
  const missingSecretProc = spawnSync(
    process.execPath,
    ["-e", "import('./src/utils/token.js').then(m => m.getJwtSecret())"],
    {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, JWT_SECRET: "" },
      encoding: "utf8"
    }
  );
  assert(
    missingSecretProc.status !== 0 && missingSecretProc.stderr.includes("JWT_SECRET is not configured"),
    "Startup check fails cleanly when JWT_SECRET is unset"
  );

  const shortSecretProc = spawnSync(
    process.execPath,
    ["-e", "import('./src/utils/token.js').then(m => m.getJwtSecret())"],
    {
      cwd: path.resolve(__dirname, ".."),
      env: { ...process.env, JWT_SECRET: "weak-12345" },
      encoding: "utf8"
    }
  );
  assert(
    shortSecretProc.status !== 0 && shortSecretProc.stderr.includes("minimum of 32 characters is required"),
    "Startup check fails cleanly when JWT_SECRET has insufficient entropy (< 32 chars)"
  );

  // 2. Public Probes & Public Login
  console.log("\n--- 2. Public Probes & Login Endpoint ---");
  const healthRes = await request("/api/health");
  assert(healthRes.status === 200 && healthRes.body.status === "ok", "GET /api/health is public (200 OK)");

  const dbHealthRes = await request("/api/health/db");
  assert(dbHealthRes.status === 200 && dbHealthRes.body.database === "connected", "GET /api/health/db is public (200 OK)");

  const loginMissing = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert(loginMissing.status === 400 && loginMissing.body.error?.code === "INVALID_INPUT", "POST /api/v1/auth/login requires email & password (400)");

  const loginNonExistent = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unknown@aicte.gov.in", password: "SomePassword123!" })
  });
  assert(loginNonExistent.status === 401 && loginNonExistent.body.error?.code === "INVALID_CREDENTIALS", "POST /api/v1/auth/login returns 401 for unknown email");

  // 3. Deny-by-Default on Protected Endpoints (Missing Token)
  console.log("\n--- 3. Deny-by-Default: Protected Endpoints Without Token (401) ---");
  const protectedEndpoints = [
    "/api/complaints",
    "/api/complaints/related",
    "/api/v1/institutions",
    "/api/v1/institutions/INST-204",
    "/api/v1/institutions/INST-204/complaints",
    "/api/v1/complaints",
    "/api/v1/complaints/CMP-1001",
    "/api/v1/complaints/CMP-1001/related",
    "/api/v1/dashboard/summary",
    "/api/v1/overlaps",
    "/api/v1/auth/me"
  ];

  for (const ep of protectedEndpoints) {
    const res = await request(ep);
    assert(res.status === 401 && res.body.error?.code === "AUTH_TOKEN_MISSING", `Blocked unauthenticated ${ep} with 401 AUTH_TOKEN_MISSING`);
  }

  // 4. Token Validation & Rejection (Malformed, Invalid, Expired, Ghost)
  console.log("\n--- 4. Token Validation & Rejection Edge Cases ---");
  const malformedHeader = await request("/api/v1/complaints", {
    headers: { Authorization: "Basic dXNlcjpwYXNz" }
  });
  assert(malformedHeader.status === 401 && malformedHeader.body.error?.code === "AUTH_TOKEN_MALFORMED", "Rejects non-Bearer header with 401 AUTH_TOKEN_MALFORMED");

  const invalidToken = await request("/api/v1/complaints", {
    headers: { Authorization: "Bearer this.is.not.a.valid.jwt" }
  });
  assert(invalidToken.status === 401 && invalidToken.body.error?.code === "AUTH_TOKEN_INVALID", "Rejects malformed JWT with 401 AUTH_TOKEN_INVALID");

  const expiredToken = generateToken(
    { id: "a0000000-0000-0000-0000-000000000001", email: "test@aicte.gov.in", role: "AUDITOR", bureau: null, full_name: "Test" },
    { expiresIn: "-1s" }
  );
  const expiredRes = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  assert(expiredRes.status === 401 && expiredRes.body.error?.code === "AUTH_TOKEN_EXPIRED", "Rejects expired JWT with 401 AUTH_TOKEN_EXPIRED");

  // Valid token signature but non-existent user in DB (users table is currently empty)
  const ghostUserToken = generateToken({
    id: "00000000-0000-0000-0000-000000000099",
    email: "ghost@aicte.gov.in",
    role: "SUPER_ADMIN",
    bureau: null,
    full_name: "Ghost User"
  });
  const ghostRes = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${ghostUserToken}` }
  });
  assert(ghostRes.status === 401 && ghostRes.body.error?.code === "USER_NOT_FOUND", "Rejects valid token when user is absent from database (401 USER_NOT_FOUND)");

  // Valid token signature with non-UUID sub format rejected cleanly without database syntax error
  const invalidSubToken = generateToken({
    id: "non-uuid-user-id",
    email: "invalid-sub@aicte.gov.in",
    role: "SUPER_ADMIN",
    bureau: null,
    full_name: "Malformed Sub"
  });
  const invalidSubRes = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${invalidSubToken}` }
  });
  assert(invalidSubRes.status === 401 && invalidSubRes.body.error?.code === "USER_NOT_FOUND", "Rejects token with non-UUID sub cleanly with 401 USER_NOT_FOUND");

  // 5. Database-Level Bureau Authorization Tests Across All 5 Roles
  console.log("\n--- 5. Database-Level Bureau Authorization & Scoping Across All 5 Roles ---");

  const superAdminUser = { id: "a0000000-0000-0000-0000-000000000001", email: "admin@aicte.gov.in", role: "SUPER_ADMIN", bureau: null, full_name: "Central Admin" };
  const sdcHeadUser = { id: "a0000000-0000-0000-0000-000000000002", email: "sdc.head@aicte.gov.in", role: "BUREAU_HEAD", bureau: "Student Development Cell", full_name: "SDC Head" };
  const sdcOfficerUser = { id: "a0000000-0000-0000-0000-000000000003", email: "sdc.officer@aicte.gov.in", role: "BUREAU_OFFICER", bureau: "Student Development Cell", full_name: "SDC Officer" };
  const grcOfficerUser = { id: "a0000000-0000-0000-0000-000000000004", email: "grc.officer@aicte.gov.in", role: "BUREAU_OFFICER", bureau: "Grievance Redressal Cell", full_name: "GRC Officer" };
  const grievanceOfficerUser = { id: "a0000000-0000-0000-0000-000000000005", email: "grievance.officer@aicte.gov.in", role: "GRIEVANCE_OFFICER", bureau: "Grievance Redressal Cell", full_name: "Grievance Officer" };
  const auditorUser = { id: "a0000000-0000-0000-0000-000000000007", email: "auditor@aicte.gov.in", role: "AUDITOR", bureau: null, full_name: "Compliance Auditor" };

  // 5.1 SUPER_ADMIN and AUDITOR have global visibility
  const BASELINE_COMPLAINTS = ["CMP-1001", "CMP-1002", "CMP-1003", "CMP-1004", "CMP-1005"];
  const adminComplaints = await listComplaints({}, { limit: 20, offset: 0 }, superAdminUser);
  const auditorComplaints = await listComplaints({}, { limit: 20, offset: 0 }, auditorUser);

  assert(
    adminComplaints.total >= 5 &&
    adminComplaints.total === auditorComplaints.total &&
    BASELINE_COMPLAINTS.every((id) => adminComplaints.complaints.some((c) => c.complaint_id === id)),
    "SUPER_ADMIN sees all baseline complaints across all bureaus",
    adminComplaints.total
  );

  assert(
    auditorComplaints.total === adminComplaints.total &&
    BASELINE_COMPLAINTS.every((id) => auditorComplaints.complaints.some((c) => c.complaint_id === id)),
    "AUDITOR sees all baseline complaints across all bureaus matching SUPER_ADMIN",
    auditorComplaints.total
  );

  const adminDashboard = await getDashboardSummary(superAdminUser);
  assert(
    adminDashboard.total_complaints === adminComplaints.total,
    "SUPER_ADMIN dashboard total_complaints equals system-wide complaints count",
    adminDashboard.total_complaints
  );

  const adminOverlaps = await listOverlaps({}, { limit: 20, offset: 0 }, superAdminUser);
  assert(adminOverlaps.total >= 2, "SUPER_ADMIN sees all overlap pairs in system", adminOverlaps.total);

  // 5.2 BUREAU_HEAD (Student Development Cell) Scoping
  const sdcHeadComplaints = await listComplaints({}, { limit: 20, offset: 0 }, sdcHeadUser);
  assert(
    sdcHeadComplaints.total === sdcHeadComplaints.complaints.length &&
    sdcHeadComplaints.complaints.every((c) => c.bureau === "Student Development Cell") &&
    ["CMP-1001", "CMP-1003"].every((id) => sdcHeadComplaints.complaints.some((c) => c.complaint_id === id)),
    "BUREAU_HEAD (SDC) SQL query strictly scoped to Student Development Cell",
    sdcHeadComplaints.total
  );

  const sdcHeadAllowed = await getComplaintById("CMP-1001", sdcHeadUser);
  assert(sdcHeadAllowed?.complaint_id === "CMP-1001", "BUREAU_HEAD (SDC) can view SDC complaint CMP-1001", sdcHeadAllowed?.complaint_id);

  let sdcHeadForbidden = false;
  try {
    await getComplaintById("CMP-1004", sdcHeadUser); // CMP-1004 is QAC
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) sdcHeadForbidden = true;
  }
  assert(sdcHeadForbidden, "BUREAU_HEAD (SDC) accessing QAC complaint CMP-1004 raises 403 FORBIDDEN_BUREAU_ACCESS");

  let sdcHeadRelatedForbidden = false;
  try {
    await getRelatedByComplaintId("CMP-1004", sdcHeadUser); // CMP-1004 is QAC
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) sdcHeadRelatedForbidden = true;
  }
  assert(sdcHeadRelatedForbidden, "BUREAU_HEAD (SDC) querying related complaints for QAC case CMP-1004 raises 403 FORBIDDEN_BUREAU_ACCESS");

  const sdcHeadOverlaps = await listOverlaps({}, { limit: 20, offset: 0 }, sdcHeadUser);
  assert(
    sdcHeadOverlaps.total >= 1 &&
    sdcHeadOverlaps.overlaps.every((o) => o.caseA.bureau === "Student Development Cell" || o.caseB.bureau === "Student Development Cell"),
    "BUREAU_HEAD (SDC) only sees overlaps where Student Development Cell is a participant",
    sdcHeadOverlaps.total
  );

  const sdcHeadDashboard = await getDashboardSummary(sdcHeadUser);
  assert(
    sdcHeadDashboard.total_complaints === sdcHeadComplaints.total,
    "BUREAU_HEAD (SDC) dashboard total_complaints equals bureau-scoped complaints count",
    sdcHeadDashboard.total_complaints
  );

  const sdcHeadInst = await getInstitutionComplaints("INST-204", {}, { limit: 20, offset: 0 }, sdcHeadUser);
  assert(
    sdcHeadInst.complaints.every((c) => c.bureau === "Student Development Cell") &&
    sdcHeadInst.complaints.some((c) => c.complaint_id === "CMP-1001"),
    "BUREAU_HEAD (SDC) institution complaint history strictly scoped to SDC",
    sdcHeadInst.total
  );

  // 5.3 BUREAU_OFFICER (Student Development Cell and Grievance Redressal Cell) Scoping
  const sdcComplaints = await listComplaints({}, { limit: 20, offset: 0 }, sdcOfficerUser);
  assert(
    sdcComplaints.total === sdcHeadComplaints.total &&
    sdcComplaints.complaints.every((c) => c.bureau === "Student Development Cell"),
    "SDC Officer SQL query strictly scoped to Student Development Cell",
    sdcComplaints.total
  );

  const grcComplaints = await listComplaints({}, { limit: 20, offset: 0 }, grcOfficerUser);
  assert(
    grcComplaints.total === grcComplaints.complaints.length &&
    grcComplaints.complaints.every((c) => c.bureau === "Grievance Redressal Cell") &&
    ["CMP-1002", "CMP-1005"].every((id) => grcComplaints.complaints.some((c) => c.complaint_id === id)),
    "GRC Officer SQL query strictly scoped to Grievance Redressal Cell",
    grcComplaints.total
  );

  const sdcAllowed = await getComplaintById("CMP-1001", sdcOfficerUser);
  assert(sdcAllowed?.complaint_id === "CMP-1001", "SDC Officer can view SDC complaint CMP-1001", sdcAllowed?.complaint_id);

  let sdcForbiddenCaught = false;
  try {
    await getComplaintById("CMP-1004", sdcOfficerUser); // CMP-1004 belongs to QAC
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) sdcForbiddenCaught = true;
  }
  assert(sdcForbiddenCaught, "SDC Officer accessing QAC complaint CMP-1004 raises 403 FORBIDDEN_BUREAU_ACCESS");

  let sdcRelatedForbiddenCaught = false;
  try {
    await getRelatedByComplaintId("CMP-1004", sdcOfficerUser);
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) sdcRelatedForbiddenCaught = true;
  }
  assert(sdcRelatedForbiddenCaught, "SDC Officer querying related complaints for QAC case CMP-1004 raises 403 FORBIDDEN_BUREAU_ACCESS");

  const sdcOverlaps = await listOverlaps({}, { limit: 20, offset: 0 }, sdcOfficerUser);
  assert(
    sdcOverlaps.total >= 1 &&
    sdcOverlaps.overlaps.every((o) => o.caseA.bureau === "Student Development Cell" || o.caseB.bureau === "Student Development Cell"),
    "SDC Officer only sees overlaps where Student Development Cell is a participant",
    sdcOverlaps.total
  );

  const sdcDashboard = await getDashboardSummary(sdcOfficerUser);
  assert(
    sdcDashboard.total_complaints === sdcComplaints.total,
    "SDC Officer dashboard total_complaints equals bureau-scoped complaints count",
    sdcDashboard.total_complaints
  );

  const sdcInstComplaints = await getInstitutionComplaints("INST-204", {}, { limit: 20, offset: 0 }, sdcOfficerUser);
  assert(
    sdcInstComplaints.complaints.every((c) => c.bureau === "Student Development Cell") &&
    sdcInstComplaints.complaints.some((c) => c.complaint_id === "CMP-1001"),
    "SDC Officer institution complaint history scoped to SDC",
    sdcInstComplaints.total
  );

  const sdcLegacy = await getLegacyComplaints(sdcOfficerUser);
  assert(
    sdcLegacy.count === sdcComplaints.total &&
    sdcLegacy.data.every((c) => c.bureau === "Student Development Cell"),
    "getLegacyComplaints enforces SDC bureau scoping",
    sdcLegacy.count
  );

  // 5.4 GRIEVANCE_OFFICER (Grievance Redressal Cell) Scoping
  const grievanceComplaints = await listComplaints({}, { limit: 20, offset: 0 }, grievanceOfficerUser);
  assert(
    grievanceComplaints.total === grcComplaints.total &&
    grievanceComplaints.complaints.every((c) => c.bureau === "Grievance Redressal Cell"),
    "GRIEVANCE_OFFICER SQL query strictly scoped to Grievance Redressal Cell",
    grievanceComplaints.total
  );

  const grievanceAllowed = await getComplaintById("CMP-1002", grievanceOfficerUser);
  assert(grievanceAllowed?.complaint_id === "CMP-1002", "GRIEVANCE_OFFICER can view GRC complaint CMP-1002", grievanceAllowed?.complaint_id);

  let grievanceForbiddenCaught = false;
  try {
    await getComplaintById("CMP-1001", grievanceOfficerUser); // CMP-1001 belongs to SDC
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) grievanceForbiddenCaught = true;
  }
  assert(grievanceForbiddenCaught, "GRIEVANCE_OFFICER accessing SDC complaint CMP-1001 raises 403 FORBIDDEN_BUREAU_ACCESS");

  let grievanceRelatedForbidden = false;
  try {
    await getRelatedByComplaintId("CMP-1004", grievanceOfficerUser); // CMP-1004 is QAC
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) grievanceRelatedForbidden = true;
  }
  assert(grievanceRelatedForbidden, "GRIEVANCE_OFFICER querying related complaints for QAC case CMP-1004 raises 403 FORBIDDEN_BUREAU_ACCESS");

  const grievanceOverlaps = await listOverlaps({}, { limit: 20, offset: 0 }, grievanceOfficerUser);
  assert(
    grievanceOverlaps.total >= 1 &&
    grievanceOverlaps.overlaps.every((o) => o.caseA.bureau === "Grievance Redressal Cell" || o.caseB.bureau === "Grievance Redressal Cell"),
    "GRIEVANCE_OFFICER only sees overlaps where Grievance Redressal Cell is a participant",
    grievanceOverlaps.total
  );

  const grievanceDashboard = await getDashboardSummary(grievanceOfficerUser);
  assert(
    grievanceDashboard.total_complaints === grievanceComplaints.total,
    "GRIEVANCE_OFFICER dashboard total_complaints equals bureau-scoped complaints count",
    grievanceDashboard.total_complaints
  );

  const grievanceLegacy = await getLegacyComplaints(grievanceOfficerUser);
  assert(
    grievanceLegacy.count === grievanceComplaints.total &&
    grievanceLegacy.data.every((c) => c.bureau === "Grievance Redressal Cell"),
    "getLegacyComplaints enforces GRC bureau scoping for GRIEVANCE_OFFICER",
    grievanceLegacy.count
  );

  // 5.5 Deny-by-default for Scoped Role with Missing Bureau
  let missingBureauCaught = false;
  try {
    await listComplaints({}, { limit: 20, offset: 0 }, { id: "u-nobureau", role: "BUREAU_OFFICER", bureau: null });
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) missingBureauCaught = true;
  }
  assert(missingBureauCaught, "Deny-by-default: Scoped officer with unassigned bureau raises 403 FORBIDDEN_BUREAU_ACCESS");

  // 6. RBAC Middleware Unit Checks
  console.log("\n--- 6. RBAC Role Restrictions & Auditor Read-Only Enforcement ---");

  let auditorBlocked = false;
  const mockReqPost = { method: "POST", user: auditorUser };
  const mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  enforceAuditorReadOnly(mockReqPost, mockRes, () => {});
  if (mockRes.statusCode === 403 && mockRes.payload?.error?.code === "AUDITOR_READ_ONLY") {
    auditorBlocked = true;
  }
  assert(auditorBlocked, "enforceAuditorReadOnly blocks POST requests by AUDITOR with 403 AUDITOR_READ_ONLY");

  let auditorGetAllowed = false;
  const mockReqGet = { method: "GET", user: auditorUser };
  enforceAuditorReadOnly(mockReqGet, mockRes, () => { auditorGetAllowed = true; });
  assert(auditorGetAllowed, "enforceAuditorReadOnly permits GET requests by AUDITOR");

  let roleDenied = false;
  const requireAdminMiddleware = authorizeRoles("SUPER_ADMIN");
  const officerReq = { user: sdcOfficerUser };
  const mockResRole = {
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
  requireAdminMiddleware(officerReq, mockResRole, () => {});
  if (mockResRole.statusCode === 403 && mockResRole.payload?.error?.code === "FORBIDDEN_ROLE") {
    roleDenied = true;
  }
  assert(roleDenied, "authorizeRoles('SUPER_ADMIN') blocks BUREAU_OFFICER with 403 FORBIDDEN_ROLE");

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  await closePool();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(async (err) => {
  await closePool();
  console.error("Test execution failed:", err);
  process.exit(1);
});
