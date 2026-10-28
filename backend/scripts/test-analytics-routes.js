/**
 * Route-Level Integration Test Suite for Analytics Endpoints
 * Tests:
 * 1. Deny-by-default for unauthenticated requests (401 across all 4 endpoints)
 * 2. Authenticated system-wide access for SUPER_ADMIN & AUDITOR (200 on all 4 endpoints)
 * 3. Auditor read-only enforcement (prohibits mutation verbs)
 * 4. Response envelopes ({ success: true, data: ... })
 * 5. Query parameters (e.g., ?limit=2 on /priority-list)
 * 6. Bureau isolation for scoped officers (SDC, GRC, QAC)
 * 7. Overlap enrichment flag verification within analytics responses
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.NODE_ENV = process.env.NODE_ENV || "test";

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
  console.log("=== Analytics Route-Level Integration Test Suite ===\n");

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error("FATAL: BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_STAFF_PASSWORD must be set in backend/.env");
    process.exit(1);
  }

  // 1. Deny-by-Default (Unauthenticated Requests)
  console.log("--- 1. Deny-by-Default: Unauthenticated Requests (401) ---");
  const endpoints = [
    "/api/v1/analytics/risk-cases",
    "/api/v1/analytics/patterns",
    "/api/v1/analytics/priority-list",
    "/api/v1/analytics/alerts"
  ];

  for (const ep of endpoints) {
    const res = await request(ep);
    assert(
      res.status === 401 && res.body?.error?.code === "AUTH_TOKEN_MISSING",
      `Blocked unauthenticated ${ep} with 401 AUTH_TOKEN_MISSING`
    );
  }

  // 2. Authenticated Central Roles (SUPER_ADMIN & AUDITOR)
  console.log("\n--- 2. Central Roles: SUPER_ADMIN & AUDITOR System-Wide Access ---");
  const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
  const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  const auditorHeaders = { Authorization: `Bearer ${auditorToken}` };

  // GET /risk-cases
  const adminRiskRes = await request("/api/v1/analytics/risk-cases", { headers: adminHeaders });
  assert(adminRiskRes.status === 200, "GET /api/v1/analytics/risk-cases returns 200 OK for SUPER_ADMIN");
  assert(adminRiskRes.body?.success === true, "Response uses { success: true, data } envelope");
  const auditorRiskRes = await request("/api/v1/analytics/risk-cases", { headers: auditorHeaders });
  assert(adminRiskRes.body?.data?.length >= 5, "SUPER_ADMIN receives open cases across bureaus");
  assert(
    adminRiskRes.body?.data?.length === auditorRiskRes.body?.data?.length,
    "SUPER_ADMIN and AUDITOR receive identical system-wide open cases count"
  );
  assert(auditorRiskRes.status === 200, "GET /api/v1/analytics/risk-cases returns 200 OK for AUDITOR");

  // GET /patterns
  const adminPatternsRes = await request("/api/v1/analytics/patterns", { headers: adminHeaders });
  assert(adminPatternsRes.status === 200, "GET /api/v1/analytics/patterns returns 200 OK");
  assert(
    adminPatternsRes.body?.data &&
    "repeatedCategories" in adminPatternsRes.body.data &&
    "risingCategories" in adminPatternsRes.body.data &&
    "busyRegions" in adminPatternsRes.body.data,
    "patterns response contains repeatedCategories, risingCategories, and busyRegions"
  );

  // GET /priority-list with query parameter limit
  const adminPriorityRes = await request("/api/v1/analytics/priority-list?limit=3", { headers: adminHeaders });
  assert(adminPriorityRes.status === 200, "GET /api/v1/analytics/priority-list returns 200 OK");
  assert(Array.isArray(adminPriorityRes.body?.data), "priority-list returns array");
  assert(adminPriorityRes.body?.data?.length <= 3, "priority-list respects limit=3 query parameter");

  // GET /alerts
  const adminAlertsRes = await request("/api/v1/analytics/alerts", { headers: adminHeaders });
  assert(adminAlertsRes.status === 200, "GET /api/v1/analytics/alerts returns 200 OK");
  assert(Array.isArray(adminAlertsRes.body?.data), "alerts returns array");

  // Auditor Read-Only Mutation Protection
  const auditorPostRes = await request("/api/v1/analytics/alerts", {
    method: "POST",
    headers: { ...auditorHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ test: true })
  });
  assert(
    auditorPostRes.status === 403 && auditorPostRes.body?.error?.code === "AUDITOR_READ_ONLY",
    "AUDITOR POST mutation attempt blocked with 403 AUDITOR_READ_ONLY"
  );

  // 3. Bureau-Scoped Officer Isolation
  console.log("\n--- 3. Bureau-Scoped Officer Isolation ---");
  const sdcToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
  const grcToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);
  const qacToken = await loginUser("qac.officer@aicte.gov.in", staffPassword);

  const sdcHeaders = { Authorization: `Bearer ${sdcToken}` };
  const grcHeaders = { Authorization: `Bearer ${grcToken}` };
  const qacHeaders = { Authorization: `Bearer ${qacToken}` };

  // SDC Officer verification
  const sdcRiskRes = await request("/api/v1/analytics/risk-cases", { headers: sdcHeaders });
  assert(sdcRiskRes.status === 200, "SDC Officer receives 200 OK on /risk-cases");
  assert(
    sdcRiskRes.body?.data?.length >= 2 &&
    ["CMP-1001", "CMP-1003"].every((id) => sdcRiskRes.body?.data?.some((c) => c.complaint_id === id)),
    "SDC Officer receives SDC cases including baseline",
    { count: sdcRiskRes.body?.data?.length }
  );
  assert(
    sdcRiskRes.body?.data?.every((c) => c.bureau === "Student Development Cell"),
    "All SDC risk cases belong strictly to Student Development Cell"
  );

  const sdcPriorityRes = await request("/api/v1/analytics/priority-list", { headers: sdcHeaders });
  assert(
    sdcPriorityRes.body?.data?.every((c) => c.bureau === "Student Development Cell"),
    "All SDC priority list items belong strictly to Student Development Cell"
  );

  const sdcAlertsRes = await request("/api/v1/analytics/alerts", { headers: sdcHeaders });
  assert(
    sdcAlertsRes.body?.data?.every((a) => a.bureau === "Student Development Cell"),
    "All SDC alerts belong strictly to Student Development Cell"
  );

  // GRC Officer verification
  const grcRiskRes = await request("/api/v1/analytics/risk-cases", { headers: grcHeaders });
  assert(
    grcRiskRes.body?.data?.length >= 2 &&
    ["CMP-1002", "CMP-1005"].every((id) => grcRiskRes.body?.data?.some((c) => c.complaint_id === id)),
    "GRC Officer receives GRC cases including baseline"
  );
  assert(
    grcRiskRes.body?.data?.every((c) => c.bureau === "Grievance Redressal Cell"),
    "All GRC risk cases belong strictly to Grievance Redressal Cell"
  );

  // QAC Officer verification
  const qacRiskRes = await request("/api/v1/analytics/risk-cases", { headers: qacHeaders });
  assert(
    qacRiskRes.body?.data?.length >= 1 &&
    qacRiskRes.body?.data?.some((c) => c.complaint_id === "CMP-1004"),
    "QAC Officer receives QAC case (CMP-1004)"
  );
  assert(qacRiskRes.body?.data?.every((c) => c.bureau === "Quality Assurance Cell"), "QAC Officer sees only Quality Assurance Cell cases");

  // 4. Operational Overlap Flags Reflected in Analytics Scoring
  console.log("\n--- 4. Operational Overlap Risk Flag Enrichment ---");
  const sdcCmp1001 = sdcRiskRes.body?.data?.find((c) => c.complaint_id === "CMP-1001");
  assert(
    sdcCmp1001?.risk?.reasons?.includes("Strong overlap with a case in another Bureau/Cell"),
    "SDC Case CMP-1001 displays 'Strong overlap with a case in another Bureau/Cell' in risk reasons"
  );

  const qacCmp1004 = qacRiskRes.body?.data?.find((c) => c.complaint_id === "CMP-1004");
  assert(
    !qacCmp1004?.risk?.reasons?.includes("Strong overlap with a case in another Bureau/Cell"),
    "QAC Case CMP-1004 correctly does NOT display overlap reason (no qualifying links)"
  );

  console.log(`\n========================================`);
  console.log(`Analytics Route Integration Tests: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
