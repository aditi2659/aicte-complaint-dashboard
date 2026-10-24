/**
 * AICTE Dashboard Frontend Integration Verification Suite
 * Tests adapter data mapping, authentication, token handling, error states, and review API integration.
 */

import assert from "node:assert";
import {
  BUREAU_NAME_TO_CODE,
  BUREAU_CODE_TO_NAME,
  mapBackendStatusToUi,
  mapUiStatusToBackend,
  mapBackendPriorityToUi,
  mapBackendCategoryToUi,
  mapBackendActionsToTimeline,
  mapBackendComplaintToUi,
  mapBackendOverlapToUi,
  mapUiReviewStatusToBackend,
  mapBackendInstitutionToUi
} from "../src/services/adapter.ts";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, ok: res.ok };
}

async function runTests() {
  console.log("=== AICTE Frontend-UI Integration Test Suite ===\n");

  // 1. Adapter Bureau & Status Mappings
  console.log("--- 1. Adapter Data Contracts & Enums ---");

  it("maps Student Development Cell to SDC code", () => {
    assert.strictEqual(BUREAU_NAME_TO_CODE["Student Development Cell"], "SDC");
    assert.strictEqual(BUREAU_CODE_TO_NAME["SDC"], "Student Development Cell");
  });

  it("maps Grievance Redressal Cell to PGRC code", () => {
    assert.strictEqual(BUREAU_NAME_TO_CODE["Grievance Redressal Cell"], "PGRC");
    assert.strictEqual(BUREAU_CODE_TO_NAME["PGRC"], "Grievance Redressal Cell");
  });

  it("maps Approval Bureau to AB code", () => {
    assert.strictEqual(BUREAU_NAME_TO_CODE["Approval Bureau"], "AB");
    assert.strictEqual(BUREAU_CODE_TO_NAME["AB"], "Approval Bureau");
  });

  it("maps backend status Open to PENDING", () => {
    assert.strictEqual(mapBackendStatusToUi("Open"), "PENDING");
  });

  it("maps backend status Under Review to UNDER_PROCESS", () => {
    assert.strictEqual(mapBackendStatusToUi("Under Review"), "UNDER_PROCESS");
  });

  it("maps backend status Assigned to UNDER_PROCESS", () => {
    assert.strictEqual(mapBackendStatusToUi("Assigned"), "UNDER_PROCESS");
  });

  it("maps backend status Resolved to DISPOSED", () => {
    assert.strictEqual(mapBackendStatusToUi("Resolved"), "DISPOSED");
  });

  it("maps UI status PENDING to backend Open", () => {
    assert.strictEqual(mapUiStatusToBackend("PENDING"), "Open");
  });

  it("maps UI status UNDER_PROCESS to backend Under Review", () => {
    assert.strictEqual(mapUiStatusToBackend("UNDER_PROCESS"), "Under Review");
  });

  it("maps UI review status CONFIRMED_RELATED to Confirmed", () => {
    assert.strictEqual(mapUiReviewStatusToBackend("CONFIRMED_RELATED"), "Confirmed");
  });

  it("maps UI review status DISMISSED to Dismissed", () => {
    assert.strictEqual(mapUiReviewStatusToBackend("DISMISSED"), "Dismissed");
  });

  it("maps backend priority Critical and Urgent to CRITICAL", () => {
    assert.strictEqual(mapBackendPriorityToUi("Critical"), "CRITICAL");
    assert.strictEqual(mapBackendPriorityToUi("Urgent"), "CRITICAL");
    assert.strictEqual(mapBackendPriorityToUi("High"), "HIGH");
    assert.strictEqual(mapBackendPriorityToUi("Medium"), "NORMAL");
    assert.strictEqual(mapBackendPriorityToUi("Low"), "LOW");
  });

  // 2. Complaint Object Normalization
  console.log("\n--- 2. Complaint Normalization & Overlap Flags ---");

  const rawSampleComplaint = {
    complaint_id: "CMP-1001",
    title: "Scholarship Delay",
    category: "Scholarship Delay",
    description: "Students report that approved scholarships have not been credited.",
    bureau: "Student Development Cell",
    priority: "High",
    status: "Under Review",
    due_date: "2026-10-12T00:00:00.000Z",
    created_at: "2026-09-12T00:00:00.000Z",
    has_overlap: true,
    matched_case_ids: ["CMP-1002"],
    institution_id: "a0000000-0000-0000-0000-000000000204",
    aicte_permanent_id: "INST-204",
    institution_name: "North Valley Institute of Technology",
    institution_state: "Maharashtra"
  };

  const normalizedComp = mapBackendComplaintToUi(rawSampleComplaint);

  it("maps complaint_id to caseNumber and id", () => {
    assert.strictEqual(normalizedComp.caseNumber, "CMP-1001");
    assert.strictEqual(normalizedComp.id, "CMP-1001");
  });

  it("maps has_overlap boolean to hasActiveOverlap", () => {
    assert.strictEqual(normalizedComp.hasActiveOverlap, true);
  });

  it("maps matched_case_ids array to linkedComplaintIds", () => {
    assert.deepStrictEqual(normalizedComp.linkedComplaintIds, ["CMP-1002"]);
  });

  it("maps Student Development Cell to SDC currentBureau", () => {
    assert.strictEqual(normalizedComp.currentBureau, "SDC");
  });

  it("maps title to subject and description faithfully", () => {
    assert.strictEqual(normalizedComp.subject, "Scholarship Delay");
    assert.strictEqual(normalizedComp.description, rawSampleComplaint.description);
  });

  // 3. Overlap Match Normalization
  console.log("\n--- 3. Overlap Normalization & Score Percentage ---");

  const rawSampleOverlap = {
    id: 1,
    similarity_score: 0.6923,
    match_reasons: ["same institution ID", "same complaint category"],
    review_status: "Suggested",
    created_at: "2026-10-21T13:27:08.983Z",
    caseA: {
      complaint_id: "CMP-1001",
      category: "Scholarship Delay",
      bureau: "Student Development Cell",
      institution_id: "INST-204"
    },
    caseB: {
      complaint_id: "CMP-1002",
      category: "Scholarship Delay",
      bureau: "Grievance Redressal Cell",
      institution_id: "INST-204"
    }
  };

  const normalizedOvr = mapBackendOverlapToUi(rawSampleOverlap);

  it("maps numeric id to string id", () => {
    assert.strictEqual(normalizedOvr.id, "1");
  });

  it("maps float similarity_score (0.6923) to percentage 69%", () => {
    assert.strictEqual(normalizedOvr.similarityScore, 69);
  });

  it("maps review_status 'Suggested' to 'UNREVIEWED'", () => {
    assert.strictEqual(normalizedOvr.reviewStatus, "UNREVIEWED");
  });

  it("correctly identifies reciprocal complaint IDs", () => {
    assert.strictEqual(normalizedOvr.complaintAId, "CMP-1001");
    assert.strictEqual(normalizedOvr.complaintBId, "CMP-1002");
  });

  it("identifies matching permanent institute ID", () => {
    assert.strictEqual(normalizedOvr.institutionMatch.samePermanentId, true);
  });

  // 4. Live Authentication Endpoint Tests
  console.log("\n--- 4. Backend Authentication Endpoint & Token Handling ---");

  let adminToken = "";
  let sdcToken = "";

  await itAsync("authenticates Central Administrator and returns JWT Bearer token", async () => {
    const res = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@aicte.gov.in",
        password: "AICTE_Admin_9aF8c3e210b48d7120"
      })
    });

    assert.strictEqual(res.status, 200, "HTTP 200 OK");
    assert.strictEqual(res.body.success, true);
    assert(typeof res.body.data.token === "string" && res.body.data.token.length > 20);
    assert.strictEqual(res.body.data.user.role, "SUPER_ADMIN");
    adminToken = res.body.data.token;
  });

  await itAsync("authenticates SDC Bureau Officer with bureau-scoped credentials", async () => {
    const res = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "sdc.officer@aicte.gov.in",
        password: "AICTE_Staff_7bE6d4c120f39a8231"
      })
    });

    assert.strictEqual(res.status, 200, "HTTP 200 OK");
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.bureau, "Student Development Cell");
    sdcToken = res.body.data.token;
  });

  await itAsync("rejects invalid password with 401 and clean error envelope", async () => {
    const res = await request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@aicte.gov.in",
        password: "WrongPassword!404"
      })
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, "INVALID_CREDENTIALS");
  });

  await itAsync("rejects unauthenticated complaints request with 401 AUTH_TOKEN_MISSING", async () => {
    const res = await request("/api/v1/complaints");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error.code, "AUTH_TOKEN_MISSING");
  });

  // 5. Authenticated Live API Loading & Bureau Scoping
  console.log("\n--- 5. Authenticated Live API Loading & Bureau Scoping ---");

  await itAsync("Admin receives all 5 live database complaints across bureaus", async () => {
    const res = await request("/api/v1/complaints", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 5);

    const uiComplaints = res.body.data.map(mapBackendComplaintToUi);
    assert.strictEqual(uiComplaints.length, 5);
    const sdcCases = uiComplaints.filter(c => c.currentBureau === "SDC");
    assert.strictEqual(sdcCases.length, 2);
  });

  await itAsync("SDC Officer strictly receives 2 bureau-scoped complaints", async () => {
    const res = await request("/api/v1/complaints", {
      headers: { Authorization: `Bearer ${sdcToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);

    const uiComplaints = res.body.data.map(mapBackendComplaintToUi);
    assert(uiComplaints.every(c => c.currentBureau === "SDC"));
  });

  await itAsync("Admin receives 2 live overlap pairs with official review flags", async () => {
    const res = await request("/api/v1/overlaps", {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.length, 2);

    const uiOverlaps = res.body.data.map(mapBackendOverlapToUi);
    assert.strictEqual(uiOverlaps.length, 2);
    assert(uiOverlaps.every(o => o.similarityScore >= 60));
  });

  // 6. Overlap Review API & Error Guard Tests
  console.log("\n--- 6. Overlap Review API Guard Rails & Error States ---");

  await itAsync("rejects non-numeric overlap link ID with 400 INVALID_INPUT", async () => {
    const res = await request("/api/v1/overlaps/invalid-id/review", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ review_status: "Confirmed" })
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, "INVALID_INPUT");
  });

  await itAsync("rejects invalid review status with 400 INVALID_INPUT", async () => {
    const res = await request("/api/v1/overlaps/1/review", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ review_status: "PendingInvestigation" })
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, "INVALID_INPUT");
  });

  await itAsync("rejects non-existent overlap link ID with 404 OVERLAP_NOT_FOUND", async () => {
    const res = await request("/api/v1/overlaps/99999/review", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ review_status: "Confirmed" })
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error.code, "OVERLAP_NOT_FOUND");
  });

  // 7. Summary
  console.log("\n========================================");
  console.log(`Frontend Integration: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
