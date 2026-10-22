/**
 * Phase 3 Verification Test Runner
 * Validates Phase 3 core services and data contracts directly against live PostgreSQL,
 * and tests public HTTP health endpoints and 404 route handling.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { listInstitutions, getInstitutionById, getInstitutionComplaints } from "../src/services/institutionService.js";
import { listComplaints, getComplaintById, getLegacyComplaints } from "../src/services/complaintService.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import { listOverlaps, getRelatedByComplaintId, getLegacyRelatedFeed } from "../src/services/overlapService.js";
import { parsePagination, buildMeta } from "../src/utils/pagination.js";

const BASE_URL = "http://localhost:4000";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);
  let body;
  try {
    body = await response.json();
  } catch {
    body = await response.text();
  }
  return { status: response.status, body };
}

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
  console.log("=== AICTE Dashboard Phase 3 Verification Suite ===\n");

  // 1. Health Endpoints (HTTP Probes)
  console.log("--- 1. Health & Database Readiness Endpoints ---");
  const h1 = await request("/api/health");
  assert(h1.status === 200 && h1.body.status === "ok", "GET /api/health returns 200 and status: ok", h1);

  const h2 = await request("/api/health/db");
  assert(h2.status === 200 && h2.body.database === "connected", "GET /api/health/db returns 200 and database: connected", h2);

  // 2. Legacy Complaint Service (PostgreSQL-backed)
  console.log("\n--- 2. Legacy Complaint Service Data Contracts ---");
  const l1 = await getLegacyComplaints();
  assert(l1.count === 5 && Array.isArray(l1.data), "getLegacyComplaints returns 5 complaints", l1);
  assert(l1.data[0]?.institutionName === "North Valley Institute of Technology", "getLegacyComplaints includes joined institutionName", l1.data[0]);

  const l2 = await getLegacyRelatedFeed();
  assert(l2.count === 2 && Array.isArray(l2.data), "getLegacyRelatedFeed returns 2 persisted overlap links", l2);
  assert(l2.data[0]?.caseA?.id === "CMP-1001" && l2.data[0]?.score > 0, "getLegacyRelatedFeed matches caseA and caseB contract", l2.data[0]);

  // 3. Institutions Service
  console.log("\n--- 3. Institutions Service Data Contracts ---");
  const i1 = await listInstitutions({}, { limit: 20, offset: 0 });
  const i1Meta = buildMeta(i1.total, 1, 20);
  assert(i1.institutions.length === 2 && i1Meta.total === 2, "listInstitutions returns 2 institutions", i1);
  assert(i1Meta.totalPages === 1, "listInstitutions meta pagination is correct", i1Meta);

  const i2 = await getInstitutionById("INST-204");
  assert(i2?.aicte_permanent_id === "INST-204", "getInstitutionById resolves by permanent ID INST-204", i2);

  const i3 = await getInstitutionById("a0000000-0000-0000-0000-000000000204");
  assert(i3?.id === "a0000000-0000-0000-0000-000000000204", "getInstitutionById resolves by UUID", i3);

  const i4 = await getInstitutionComplaints("INST-204", {}, { limit: 20, offset: 0 });
  assert(i4?.complaints?.length === 3 && i4?.total === 3, "getInstitutionComplaints returns 3 complaints for INST-204", i4);

  // 4. Complaints Service
  console.log("\n--- 4. Complaints Service Data Contracts ---");
  const c1 = await listComplaints({}, { limit: 20, offset: 0 });
  assert(c1.complaints.length === 5 && c1.total === 5, "listComplaints returns 5 complaints", c1);

  const c2 = await listComplaints({ bureau: "Student Development Cell" }, { limit: 20, offset: 0 });
  assert(c2.complaints.length === 2 && c2.total === 2, "listComplaints with bureau filter returns 2 complaints", c2);

  const c3 = await getComplaintById("CMP-1001");
  assert(c3?.complaint_id === "CMP-1001" && c3?.institution?.name, "getComplaintById CMP-1001 includes nested institution", c3);
  assert(Array.isArray(c3?.actions) && c3.actions.length >= 1, "getComplaintById CMP-1001 includes audit actions history", c3?.actions);

  // 5. Dashboard Service Summary
  console.log("\n--- 5. Dashboard Service Aggregations ---");
  const d1 = await getDashboardSummary();
  assert(d1.total_complaints === 5, "Dashboard total_complaints equals 5", d1);
  assert(d1.by_status?.Open === 2 && d1.by_status?.["Under Review"] === 2, "Dashboard by_status matches live DB", d1.by_status);
  assert(d1.overlaps?.total === 2 && d1.overlaps?.suggested === 2, "Dashboard overlaps count matches live DB", d1.overlaps);

  // 6. Overlaps Service & Related Cases
  console.log("\n--- 6. Overlaps Service Data Contracts ---");
  const o1 = await listOverlaps({}, { limit: 20, offset: 0 });
  assert(o1.overlaps.length === 2 && o1.total === 2, "listOverlaps returns 2 overlap pairs", o1);
  assert(o1.overlaps[0]?.caseA?.complaint_id === "CMP-1001" && o1.overlaps[0]?.caseB?.complaint_id === "CMP-1002", "Overlap canonical order and case details match", o1.overlaps[0]);

  const o2 = await getRelatedByComplaintId("CMP-1001");
  assert(o2?.related_cases?.length === 1, "getRelatedByComplaintId returns 1 linked case for CMP-1001", o2);
  assert(o2?.related_cases[0]?.matched_complaint?.complaint_id === "CMP-1002", "Matched complaint is CMP-1002", o2?.related_cases[0]);

  const o3 = await getRelatedByComplaintId("CMP-1004");
  assert(o3?.related_cases?.length === 0, "getRelatedByComplaintId returns empty related_cases array for CMP-1004", o3);

  // 7. Input Validation & Error Handling
  console.log("\n--- 7. Input Validation & Error Handling ---");
  const e1 = await getInstitutionById("UNKNOWN-INST");
  assert(e1 === null, "getInstitutionById returns null for unknown institution", e1);

  const e2 = await getComplaintById("CMP-9999");
  assert(e2 === null, "getComplaintById returns null for unknown complaint", e2);

  const e3 = await getRelatedByComplaintId("CMP-9999");
  assert(e3 === null, "getRelatedByComplaintId returns null for unknown complaint", e3);

  const p1 = parsePagination({ page: "abc" });
  assert(Boolean(p1.error), "parsePagination flags non-integer page as invalid", p1.error);

  const p2 = parsePagination({ limit: "999" });
  assert(Boolean(p2.error), "parsePagination flags limit exceeding max allowable limit (100)", p2.error);

  const unmappedRoute = await request("/api/v1/nonexistent-route");
  assert(unmappedRoute.status === 404 && unmappedRoute.body.error?.code === "RESOURCE_NOT_FOUND", "404 for unmapped route", unmappedRoute.body);

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
