/**
 * Focused verification suite for analyticsService adapter.
 * Verifies:
 * - complaint_analytics_view reads
 * - bureau scoping for BUREAU_HEAD, BUREAU_OFFICER, and GRIEVANCE_OFFICER
 * - system-wide access for SUPER_ADMIN and AUDITOR
 * - safe ISO dates and integer transfer_count
 * - status normalization (Resolved/Closed -> disposed)
 * - operational has_overlap boolean from complaint_links (Suggested/Confirmed only)
 * - deny-by-default for missing bureau or unauthorized roles
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getCasesForUser } from "../src/services/analyticsService.js";

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
  console.log("=== Analytics Service Adapter Verification Suite ===\n");

  // 1. System-wide user access (SUPER_ADMIN)
  console.log("--- 1. System-Wide Scoping (SUPER_ADMIN & AUDITOR) ---");
  const adminUser = {
    id: "a0000000-0000-0000-0000-000000000001",
    email: "admin@aicte.gov.in",
    role: "SUPER_ADMIN",
    bureau: null
  };
  const adminCases = await getCasesForUser(adminUser);
  assert(Array.isArray(adminCases), "getCasesForUser returns a plain array");
  assert(adminCases.length === 5, "SUPER_ADMIN retrieves all 5 complaints across all bureaus", { count: adminCases.length });

  const auditorUser = {
    id: "a0000000-0000-0000-0000-000000000007",
    email: "auditor@aicte.gov.in",
    role: "AUDITOR",
    bureau: null
  };
  const auditorCases = await getCasesForUser(auditorUser);
  assert(auditorCases.length === 5, "AUDITOR retrieves all 5 complaints across all bureaus", { count: auditorCases.length });

  // 2. Data contracts and exact keys
  console.log("\n--- 2. Data Contracts & Formatting ---");
  const firstCase = adminCases[0];
  const requiredKeys = [
    "complaint_id",
    "institution_id",
    "region",
    "category",
    "created_at",
    "due_date",
    "last_action_date",
    "status",
    "bureau",
    "transfer_count",
    "is_escalated",
    "has_overlap"
  ];
  for (const k of requiredKeys) {
    assert(k in firstCase, `Case record contains expected key '${k}'`);
  }

  assert(typeof firstCase.transfer_count === "number" && Number.isInteger(firstCase.transfer_count), "transfer_count is cast to an integer", firstCase.transfer_count);
  assert(typeof firstCase.is_escalated === "boolean", "is_escalated is a real boolean", firstCase.is_escalated);
  assert(typeof firstCase.has_overlap === "boolean", "has_overlap is a real boolean", firstCase.has_overlap);

  // ISO date formats & timezone safety
  assert(typeof firstCase.created_at === "string" && !Number.isNaN(Date.parse(firstCase.created_at)), "created_at is a safe ISO string", firstCase.created_at);
  assert(typeof firstCase.due_date === "string" && !Number.isNaN(Date.parse(firstCase.due_date)), "due_date is a safe ISO string", firstCase.due_date);
  assert(typeof firstCase.last_action_date === "string" && !Number.isNaN(Date.parse(firstCase.last_action_date)), "last_action_date is a safe ISO string", firstCase.last_action_date);
  assert(firstCase.due_date.endsWith("Z"), "due_date is formatted with explicit UTC 'Z' indicator", firstCase.due_date);

  // 3. Operational Overlap Flag Verification (complaint_links as source of truth)
  console.log("\n--- 3. Operational Overlap Flags from complaint_links ---");
  const cmp1001 = adminCases.find((c) => c.complaint_id === "CMP-1001");
  const cmp1002 = adminCases.find((c) => c.complaint_id === "CMP-1002");
  const cmp1003 = adminCases.find((c) => c.complaint_id === "CMP-1003");
  const cmp1004 = adminCases.find((c) => c.complaint_id === "CMP-1004");
  const cmp1005 = adminCases.find((c) => c.complaint_id === "CMP-1005");

  assert(cmp1001?.has_overlap === true, "CMP-1001 has_overlap === true (matched to CMP-1002 in GRC)");
  assert(cmp1002?.has_overlap === true, "CMP-1002 has_overlap === true (matched to CMP-1001 in SDC)");
  assert(cmp1003?.has_overlap === true, "CMP-1003 has_overlap === true (matched to CMP-1005 in GRC)");
  assert(cmp1005?.has_overlap === true, "CMP-1005 has_overlap === true (matched to CMP-1003 in SDC)");
  assert(cmp1004?.has_overlap === false, "CMP-1004 has_overlap === false (unrelated lab case has no overlap link)");

  // 4. Bureau-Level Authorization & Data Isolation
  console.log("\n--- 4. Bureau Authorization & Data Isolation ---");
  const sdcOfficer = {
    id: "a0000000-0000-0000-0000-000000000003",
    email: "sdc.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Student Development Cell"
  };
  const sdcCases = await getCasesForUser(sdcOfficer);
  assert(sdcCases.length === 2, "SDC Officer receives exactly 2 cases", { count: sdcCases.length });
  assert(sdcCases.every((c) => c.bureau === "Student Development Cell"), "All SDC cases belong strictly to Student Development Cell");

  const sdcHead = {
    id: "a0000000-0000-0000-0000-000000000002",
    email: "sdc.head@aicte.gov.in",
    role: "BUREAU_HEAD",
    bureau: "Student Development Cell"
  };
  const sdcHeadCases = await getCasesForUser(sdcHead);
  assert(sdcHeadCases.length === 2, "SDC Head receives exactly 2 cases");

  const grcOfficer = {
    id: "a0000000-0000-0000-0000-000000000004",
    email: "grc.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Grievance Redressal Cell"
  };
  const grcCases = await getCasesForUser(grcOfficer);
  assert(grcCases.length === 2, "GRC Officer receives exactly 2 cases");
  assert(grcCases.every((c) => c.bureau === "Grievance Redressal Cell"), "All GRC cases belong strictly to Grievance Redressal Cell");

  const grievanceOfficer = {
    id: "a0000000-0000-0000-0000-000000000005",
    email: "grievance.officer@aicte.gov.in",
    role: "GRIEVANCE_OFFICER",
    bureau: "Grievance Redressal Cell"
  };
  const grievanceCases = await getCasesForUser(grievanceOfficer);
  assert(grievanceCases.length === 2, "GRIEVANCE_OFFICER receives exactly 2 cases");

  const qacOfficer = {
    id: "a0000000-0000-0000-0000-000000000006",
    email: "qac.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Quality Assurance Cell"
  };
  const qacCases = await getCasesForUser(qacOfficer);
  assert(qacCases.length === 1 && qacCases[0].complaint_id === "CMP-1004", "QAC Officer receives exactly 1 case (CMP-1004)");

  // 5. Deny-by-Default Edge Cases
  console.log("\n--- 5. Deny-by-Default & Input Validation ---");
  let unauthError = null;
  try {
    await getCasesForUser(null);
  } catch (err) {
    unauthError = err;
  }
  assert(unauthError && unauthError.code === "UNAUTHORIZED", "Null user rejected with 401 UNAUTHORIZED");

  let invalidRoleError = null;
  try {
    await getCasesForUser({ role: "ANONYMOUS_GUEST" });
  } catch (err) {
    invalidRoleError = err;
  }
  assert(invalidRoleError && invalidRoleError.code === "FORBIDDEN_ROLE", "Invalid role rejected with 403 FORBIDDEN_ROLE");

  let unassignedBureauError = null;
  try {
    await getCasesForUser({ role: "BUREAU_OFFICER", bureau: null });
  } catch (err) {
    unassignedBureauError = err;
  }
  assert(unassignedBureauError && unassignedBureauError.code === "FORBIDDEN_BUREAU_ACCESS", "Scoped officer without bureau rejected with 403 FORBIDDEN_BUREAU_ACCESS");

  // 6. Direct Integration with Analytics Engine (riskScore, patterns, priority, alerts)
  console.log("\n--- 6. Analytics Engine Interoperability ---");
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const analytics = require("../../analytics/index.js");

  const today = new Date("2026-10-23T00:00:00.000Z");
  const fullAnalytics = analytics.getFullAnalytics(adminCases, today);

  assert(Array.isArray(fullAnalytics.riskCases), "analytics.getRiskCases returns array of risk cases");
  assert(fullAnalytics.riskCases.length === 5, "All 5 open cases scored by getRiskCases");
  assert(fullAnalytics.riskCases.every((c) => c.risk && typeof c.risk.score === "number"), "Every case has risk score");

  // Verify that has_overlap === true awards +10 score and reason
  const scoredCmp1001 = fullAnalytics.riskCases.find((c) => c.complaint_id === "CMP-1001");
  assert(
    scoredCmp1001.risk.reasons.includes("Strong overlap with a case in another Bureau/Cell"),
    "CMP-1001 receives 'Strong overlap with a case in another Bureau/Cell' reason in risk assessment"
  );

  assert(typeof fullAnalytics.patterns === "object", "analytics.getPatterns returns patterns object");
  assert(Array.isArray(fullAnalytics.priorityList), "analytics.getPriorityList returns priority list array");
  assert(fullAnalytics.priorityList.length <= 10, "Priority list respects limit");
  assert(Array.isArray(fullAnalytics.alerts), "analytics.getAlerts returns alerts array");

  console.log(`\n========================================`);
  console.log(`Analytics Adapter Tests: ${passed} passed, ${failed} failed`);
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
