/**
 * Verification Suite for Audit-Log Listing API
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Super Admin and Auditor have system-wide read access)
 * 3. Scoped bureau isolation (Bureau Officer sees only complaints within authorized bureau scope)
 * 4. Filter authorization: scoped officer cannot bypass bureau isolation via complaint_id or bureau query params
 * 5. Deny access for scoped role with null bureau (403 FORBIDDEN_BUREAU_ACCESS)
 * 6. Valid pagination and meta computation (page, limit, total, totalPages)
 * 7. Invalid pagination handling (page=0, page=-1, page=abc, limit=0, limit=999, limit=xyz -> 400 INVALID_INPUT)
 * 8. Optional filters (complaint_id, action_type, bureau name / code)
 * 9. Structured response contracts and schema compliance
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getPool } from "../src/config/db.js";
import { listAuditLogs } from "../src/services/auditService.js";

const BASE_URL = "http://localhost:4000";

let passed = 0;
let failed = 0;

function assert(condition, message, details = "") {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    if (details) console.error(`         ${typeof details === "object" ? JSON.stringify(details) : details}`);
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

async function loginUser(email, password) {
  const res = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (res.status !== 200 || !res.body?.data?.token) {
    throw new Error(`Failed to login user ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.token;
}

async function runTests() {
  console.log("=== Audit-Log Listing API Verification Suite ===\n");

  const pool = getPool();
  if (!pool) {
    console.error("FATAL: Database pool could not be initialized.");
    process.exit(1);
  }

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error("FATAL: BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_STAFF_PASSWORD must be configured in .env");
    process.exit(1);
  }

  // Obtain login tokens
  const superAdminToken = await loginUser("admin@aicte.gov.in", adminPassword);
  const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);
  const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
  const grcOfficerToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);

  // 1. Authentication & Role-Based Access Control
  console.log("\n--- 1. Authentication & Role-Based Access Control ---");

  const unauthRes = await request("/api/v1/audit-logs");
  assert(unauthRes.status === 401, "Unauthenticated GET /api/v1/audit-logs rejected with 401 AUTH_TOKEN_MISSING", unauthRes);
  assert(unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING", "Error code is AUTH_TOKEN_MISSING");

  const adminRes = await request("/api/v1/audit-logs?page=1&limit=20", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(adminRes.status === 200, "Super Admin GET /api/v1/audit-logs succeeds with 200", adminRes);
  assert(adminRes.body?.success === true, "Response envelope contains success: true");
  assert(Array.isArray(adminRes.body?.data), "Response data is an array");
  assert(adminRes.body?.meta?.total >= 5, `Super Admin sees all audit logs across bureaus (total: ${adminRes.body?.meta?.total})`);

  const auditorRes = await request("/api/v1/audit-logs?page=1&limit=20", {
    headers: { Authorization: `Bearer ${auditorToken}` }
  });
  assert(auditorRes.status === 200, "Auditor GET /api/v1/audit-logs succeeds with 200", auditorRes);
  assert(auditorRes.body?.meta?.total === adminRes.body?.meta?.total, "Auditor has system-wide read access identical to Super Admin");

  // 2. Scoped Bureau Isolation
  console.log("\n--- 2. Scoped Bureau Isolation & Anti-Bypass ---");

  const sdcRes = await request("/api/v1/audit-logs?page=1&limit=20", {
    headers: { Authorization: `Bearer ${sdcOfficerToken}` }
  });
  assert(sdcRes.status === 200, "SDC Officer GET /api/v1/audit-logs succeeds with 200");
  const sdcLogs = sdcRes.body?.data || [];
  const allSdcScoped = sdcLogs.every(
    (l) => l.bureau === "Student Development Cell" || l.originating_bureau === "Student Development Cell"
  );
  assert(allSdcScoped, "All logs returned to SDC officer are scoped to Student Development Cell");
  assert(sdcLogs.length < adminRes.body?.meta?.total, "SDC officer total is strictly subset of system-wide total");

  // Try to bypass bureau isolation by filtering for an out-of-scope complaint (CMP-1002 is Approval Bureau)
  const bypassCompRes = await request("/api/v1/audit-logs?complaint_id=CMP-1002", {
    headers: { Authorization: `Bearer ${sdcOfficerToken}` }
  });
  assert(bypassCompRes.status === 200, "SDC Officer query for CMP-1002 returns 200");
  assert(bypassCompRes.body?.data?.length === 0, "SDC Officer query for CMP-1002 returns 0 logs (cannot bypass bureau scope)");
  assert(bypassCompRes.body?.meta?.total === 0, "SDC Officer query for CMP-1002 meta total is 0");

  // Try to bypass bureau isolation by supplying bureau filter for another bureau
  const bypassBureauRes = await request("/api/v1/audit-logs?bureau=Approval%20Bureau", {
    headers: { Authorization: `Bearer ${sdcOfficerToken}` }
  });
  assert(bypassBureauRes.status === 200, "SDC Officer query for Approval Bureau returns 200");
  assert(bypassBureauRes.body?.data?.length === 0, "SDC Officer cannot see Approval Bureau logs via bureau filter");

  // 3. User with Null Bureau Isolation
  console.log("\n--- 3. Scoped Staff Without Assigned Bureau ---");
  let nullBureauBlocked = false;
  try {
    await listAuditLogs({}, { id: "mock-id", role: "BUREAU_OFFICER", bureau: null });
  } catch (err) {
    if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) {
      nullBureauBlocked = true;
    }
  }
  assert(nullBureauBlocked, "Scoped staff member without assigned bureau is rejected with 403 FORBIDDEN_BUREAU_ACCESS");

  // 4. Pagination Validation & Navigation
  console.log("\n--- 4. Pagination Validation & Navigation ---");

  const page1Res = await request("/api/v1/audit-logs?page=1&limit=2", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(page1Res.status === 200, "GET ?page=1&limit=2 returns 200");
  assert(page1Res.body?.data?.length === 2, "Page 1 returns exactly 2 records");
  assert(page1Res.body?.meta?.page === 1, "Meta page is 1");
  assert(page1Res.body?.meta?.limit === 2, "Meta limit is 2");
  assert(page1Res.body?.meta?.totalPages >= 3, "Meta totalPages is calculated correctly");

  const page2Res = await request("/api/v1/audit-logs?page=2&limit=2", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(page2Res.status === 200, "GET ?page=2&limit=2 returns 200");
  assert(page2Res.body?.data?.length === 2, "Page 2 returns exactly 2 records");
  assert(page2Res.body?.meta?.page === 2, "Meta page is 2");
  assert(page1Res.body.data[0].id !== page2Res.body.data[0].id, "Page 1 and Page 2 records are distinct");

  // Invalid pagination tests
  const invalidPages = [
    { query: "page=0&limit=10", label: "page=0" },
    { query: "page=-5&limit=10", label: "page=-5" },
    { query: "page=abc&limit=10", label: "page=abc" },
    { query: "page=1&limit=0", label: "limit=0" },
    { query: "page=1&limit=-1", label: "limit=-1" },
    { query: "page=1&limit=xyz", label: "limit=xyz" },
    { query: "page=1&limit=1000", label: "limit=1000 (> 100)" }
  ];

  for (const { query: q, label } of invalidPages) {
    const res = await request(`/api/v1/audit-logs?${q}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    assert(res.status === 400, `Invalid pagination (${label}) rejected with 400`, res.body);
    assert(res.body?.error?.code === "INVALID_INPUT", `Error code for ${label} is INVALID_INPUT`);
  }

  // 5. Query Filters
  console.log("\n--- 5. Query Filters (complaint_id, action_type, bureau) ---");

  // Filter by complaint_id
  const filterCompRes = await request("/api/v1/audit-logs?complaint_id=CMP-1001", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(filterCompRes.status === 200, "Filter by complaint_id=CMP-1001 returns 200");
  const compLogs = filterCompRes.body?.data || [];
  assert(compLogs.length > 0, "Logs found for CMP-1001");
  assert(compLogs.every((l) => l.complaint_id === "CMP-1001"), "All returned logs match complaint_id CMP-1001");

  // Filter by action_type
  const filterActionRes = await request("/api/v1/audit-logs?action_type=CREATED", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(filterActionRes.status === 200, "Filter by action_type=CREATED returns 200");
  const actionLogs = filterActionRes.body?.data || [];
  assert(actionLogs.length > 0, "Logs found for action_type CREATED");
  assert(actionLogs.every((l) => l.action_type === "CREATED"), "All returned logs have action_type CREATED");

  // Filter by bureau code
  const filterBureauCodeRes = await request("/api/v1/audit-logs?bureau=SDC", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(filterBureauCodeRes.status === 200, "Filter by bureau code 'SDC' returns 200");
  const sdcFilterLogs = filterBureauCodeRes.body?.data || [];
  assert(sdcFilterLogs.length > 0, "Logs found for bureau SDC");
  assert(
    sdcFilterLogs.every((l) => l.bureau === "Student Development Cell" || l.originating_bureau === "Student Development Cell"),
    "All logs returned for bureau=SDC belong to Student Development Cell"
  );

  // Filter for non-existent complaint
  const nonExistentRes = await request("/api/v1/audit-logs?complaint_id=CMP-DOES-NOT-EXIST", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(nonExistentRes.status === 200, "Non-existent complaint filter returns 200");
  assert(nonExistentRes.body?.data?.length === 0, "Non-existent complaint returns empty array");
  assert(nonExistentRes.body?.meta?.total === 0, "Non-existent complaint meta total is 0");

  // 6. Response Payload Contracts & Schema Integrity
  console.log("\n--- 6. Response Payload Contracts & Schema Integrity ---");
  const sampleLog = adminRes.body?.data?.[0];
  assert(Boolean(sampleLog?.id), "Log contains valid id");
  assert(Boolean(sampleLog?.complaint_id), "Log contains valid complaint_id");
  assert(Boolean(sampleLog?.action_type), "Log contains valid action_type");
  assert(Boolean(sampleLog?.action), "Log contains valid action string");
  assert(typeof sampleLog?.actor === "object", "Log contains structured actor object");
  assert(Boolean(sampleLog?.actor?.name), "Actor object contains name");
  assert(typeof sampleLog?.details === "object", "Log contains structured details object");
  assert(Boolean(sampleLog?.created_at), "Log contains ISO timestamp created_at");

  console.log("\n==========================================");
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled verification error:", err);
  process.exit(1);
});
