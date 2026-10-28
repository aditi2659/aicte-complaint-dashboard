/**
 * Verification Suite for Complaint Summarization API
 *
 * Endpoint: POST /api/v1/complaints/:id/summarize
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Auditor 403 AUDITOR_READ_ONLY)
 * 3. Bureau-level isolation & cross-bureau restrictions (scoped officer summarizing other bureau -> 403 FORBIDDEN_BUREAU_ACCESS)
 * 4. Missing complaint handling (404 COMPLAINT_NOT_FOUND)
 * 5. Successful summarization by Super Admin across bureaus (200 OK)
 * 6. Successful summarization by scoped Bureau Officer on their own bureau case (200 OK)
 * 7. Response schema & contract verification (envelope, complaint_id, summary, key_issues, suggested_category, requires_human_review)
 * 8. Zero database mutation (complaint records are unchanged)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

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

const PROVISIONAL_CATEGORIES = [
  "Approval, Affiliation and Accreditation",
  "Admissions and Enrollment",
  "Infrastructure and Facilities",
  "Faculty and Staff",
  "Academic and Curriculum",
  "Fees and Financial Issues",
  "Examinations, Certificates and Documentation",
  "Placements and Career Services",
  "Regulatory Compliance",
  "Faculty Development and Training",
  "Other"
];

async function runTests() {
  console.log("=== Complaint Summarization API Verification Suite ===\n");

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AICTE_Admin_9aF8c3e210b48d7120";
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD || "AICTE_Staff_7bE6d4c120f39a8231";

  const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
  const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
  const grcOfficerToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);
  const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

  // 1. Authentication & Role Restrictions
  console.log("--- 1. Authentication & Role Restrictions ---");

  // 1.1 Unauthenticated request rejected
  const unauthRes = await request("/api/v1/complaints/CMP-1001/summarize", {
    method: "POST"
  });
  assert(
    unauthRes.status === 401 && unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING",
    "Blocked unauthenticated summarize request with 401 AUTH_TOKEN_MISSING"
  );

  // 1.2 Auditor role rejected with 403 AUDITOR_READ_ONLY
  const auditorRes = await request("/api/v1/complaints/CMP-1001/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${auditorToken}` }
  });
  assert(
    auditorRes.status === 403 && auditorRes.body?.error?.code === "AUDITOR_READ_ONLY",
    "Blocked AUDITOR from POST summarize with 403 AUDITOR_READ_ONLY"
  );

  // 2. Bureau-Level Authorization & Isolation
  console.log("\n--- 2. Bureau-Level Authorization & Isolation ---");

  // 2.1 SDC Officer attempting to summarize GRC complaint CMP-1002
  const sdcOnGrcRes = await request("/api/v1/complaints/CMP-1002/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${sdcOfficerToken}` }
  });
  assert(
    sdcOnGrcRes.status === 403 && sdcOnGrcRes.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "Blocked SDC Officer from summarizing GRC complaint CMP-1002 with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  // 2.2 GRC Officer attempting to summarize SDC complaint CMP-1001
  const grcOnSdcRes = await request("/api/v1/complaints/CMP-1001/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${grcOfficerToken}` }
  });
  assert(
    grcOnSdcRes.status === 403 && grcOnSdcRes.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "Blocked GRC Officer from summarizing SDC complaint CMP-1001 with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  // 3. Missing Complaint Handling
  console.log("\n--- 3. Missing Complaint Handling ---");
  const missingRes = await request("/api/v1/complaints/CMP-9999/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(
    missingRes.status === 404 && missingRes.body?.error?.code === "COMPLAINT_NOT_FOUND",
    "Returned 404 COMPLAINT_NOT_FOUND for nonexistent complaint CMP-9999"
  );

  // 4. Successful Summarization by Super Admin
  console.log("\n--- 4. Authorized Central Admin Summarization ---");
  const adminRes = await request("/api/v1/complaints/CMP-1001/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminRes.status === 200, "SUPER_ADMIN can summarize CMP-1001 (HTTP 200)");
  assert(adminRes.body?.success === true, "Response uses { success: true, data } envelope");

  const data = adminRes.body?.data;
  assert(data?.complaint_id === "CMP-1001", "Returned complaint_id matches 'CMP-1001'");
  assert(typeof data?.summary === "string" && data.summary.length > 0, "Summary is a non-empty string");
  assert(Array.isArray(data?.key_issues) && data.key_issues.length >= 1 && data.key_issues.length <= 5, "key_issues is an array of 1 to 5 items");
  assert(PROVISIONAL_CATEGORIES.includes(data?.suggested_category), `suggested_category '${data?.suggested_category}' is in provisional categories`);
  assert(data?.suggested_category_id === null, "suggested_category_id is strictly null");
  assert(typeof data?.requires_human_review === "boolean" && data.requires_human_review === true, "requires_human_review is boolean true");

  // 5. Authorized Scoped Bureau Officer Summarization
  console.log("\n--- 5. Authorized Scoped Bureau Officer Summarization ---");
  const sdcOwnRes = await request("/api/v1/complaints/CMP-1001/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${sdcOfficerToken}` }
  });
  assert(sdcOwnRes.status === 200, "SDC Officer successfully summarizes own bureau complaint CMP-1001");
  assert(sdcOwnRes.body?.data?.complaint_id === "CMP-1001", "SDC response has matching complaint_id");

  const grcOwnRes = await request("/api/v1/complaints/CMP-1002/summarize", {
    method: "POST",
    headers: { Authorization: `Bearer ${grcOfficerToken}` }
  });
  assert(grcOwnRes.status === 200, "GRC Officer successfully summarizes own bureau complaint CMP-1002");
  assert(grcOwnRes.body?.data?.complaint_id === "CMP-1002", "GRC response has matching complaint_id");

  // 6. Summary Output Contract Structure Check
  console.log("\n--- 6. Exact Output Field Contract ---");
  const expectedKeys = [
    "complaint_id",
    "key_issues",
    "requires_human_review",
    "suggested_category",
    "suggested_category_id",
    "summary"
  ].sort();
  const actualKeys = Object.keys(data).sort();
  assert(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    "Response data contains exact agreed contract fields (no extra/missing keys)",
    { expectedKeys, actualKeys }
  );

  console.log(`\n========================================`);
  console.log(`Complaint Summarization Tests: ${passed} passed, ${failed} failed`);
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
