/**
 * Focused Verification Suite for Overlap Review API
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Auditor 403 AUDITOR_READ_ONLY, invalid role 403 FORBIDDEN_ROLE)
 * 3. Input validation (invalid IDs, missing or invalid review_status -> 400 INVALID_INPUT)
 * 4. Missing record handling (non-existent link -> 404 OVERLAP_NOT_FOUND)
 * 5. Bureau-level isolation & cross-bureau denial (unauthorized bureau -> 403 FORBIDDEN_BUREAU_ACCESS)
 * 6. Successful review transitions (Suggested -> Confirmed, Suggested -> Dismissed)
 * 7. requires_official_review preservation (Suggested: true, Confirmed/Dismissed: false)
 * 8. Invalid status transition prevention (re-reviewing non-Suggested links -> 409 INVALID_STATUS_TRANSITION)
 * 9. Audit logging in complaint_actions (records action_type, actor, notes, and details for both complaints)
 * 10. Complete database isolation and post-test teardown
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.NODE_ENV = process.env.NODE_ENV || "test";

import { getPool, closePool } from "../src/config/db.js";
import { generateToken } from "../src/utils/token.js";

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
  console.log("=== Overlap Review API Verification Suite ===\n");

  const pool = getPool();
  if (!pool) {
    throw new Error("Database pool is not available.");
  }
  const dbClient = await pool.connect();

  let tempLinkId1 = null;
  let tempLinkId2 = null;

  try {
    // 0. Setup Temporary Test Complaints and Overlap Links in Database
    console.log("--- 0. Test Fixture Setup ---");
    await dbClient.query(`
      INSERT INTO complaints (
        complaint_id, institution_id, category, title, description,
        bureau, originating_bureau, status, priority, due_date
      ) VALUES
        ('CMP-TEST-REV-1', 'a0000000-0000-0000-0000-000000000204', 'Hostel Facilities', 'Temp SDC Case', 'Hostel sanitation concerns', 'Student Development Cell', 'Student Development Cell', 'Open', 'Medium', NOW() + INTERVAL '30 days'),
        ('CMP-TEST-REV-2', 'a0000000-0000-0000-0000-000000000204', 'Hostel Facilities', 'Temp GRC Case', 'Hostel water supply issues', 'Grievance Redressal Cell', 'Grievance Redressal Cell', 'Open', 'Medium', NOW() + INTERVAL '30 days'),
        ('CMP-TEST-REV-3', 'a0000000-0000-0000-0000-000000000204', 'Hostel Facilities', 'Temp GRC Case 2', 'Hostel dining concerns', 'Grievance Redressal Cell', 'Grievance Redressal Cell', 'Open', 'Low', NOW() + INTERVAL '30 days')
      ON CONFLICT (complaint_id) DO NOTHING;
    `);

    const link1Res = await dbClient.query(`
      INSERT INTO complaint_links (
        complaint_id_a, complaint_id_b, similarity_score, match_reasons, review_status
      ) VALUES (
        'CMP-TEST-REV-1', 'CMP-TEST-REV-2', 0.7850, '["same institution ID", "same complaint category"]'::jsonb, 'Suggested'
      ) RETURNING id;
    `);
    tempLinkId1 = link1Res.rows[0].id;

    const link2Res = await dbClient.query(`
      INSERT INTO complaint_links (
        complaint_id_a, complaint_id_b, similarity_score, match_reasons, review_status
      ) VALUES (
        'CMP-TEST-REV-1', 'CMP-TEST-REV-3', 0.7200, '["same institution ID", "same complaint category"]'::jsonb, 'Suggested'
      ) RETURNING id;
    `);
    tempLinkId2 = link2Res.rows[0].id;

    assert(tempLinkId1 && tempLinkId2, "Test overlap fixture links successfully created in database");

    // Authenticate tokens for demo accounts
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AICTE_Admin_9aF8c3e210b48d7120";
    const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD || "AICTE_Staff_7bE6d4c120f39a8231";

    const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
    const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
    const qacOfficerToken = await loginUser("qac.officer@aicte.gov.in", staffPassword);
    const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

    // 1. Deny-by-Default for Unauthenticated Requests
    console.log("\n--- 1. Deny-by-Default: Unauthenticated Requests ---");
    const unauthRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(unauthRes.status === 401, "Unauthenticated review request rejected with 401");
    assert(unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING", "Error code is AUTH_TOKEN_MISSING");

    // 2. Role-Based Access Control (Auditor read-only and unauthorized roles)
    console.log("\n--- 2. RBAC & Auditor Mutation Protection ---");
    const auditorRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auditorToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(auditorRes.status === 403, "AUDITOR review request rejected with 403");
    assert(
      auditorRes.body?.error?.code === "AUDITOR_READ_ONLY",
      "Auditor error code is AUDITOR_READ_ONLY"
    );

    // Unit check for authorizeRoles with an unauthorized role
    const { authorizeRoles } = await import("../src/middleware/rbac.js");
    const reviewGuard = authorizeRoles("SUPER_ADMIN", "BUREAU_HEAD", "BUREAU_OFFICER", "GRIEVANCE_OFFICER");
    let forbiddenRoleCaught = false;
    let forbiddenRoleCode = "";
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(payload) {
        if (this.statusCode === 403 && payload?.error?.code === "FORBIDDEN_ROLE") {
          forbiddenRoleCaught = true;
          forbiddenRoleCode = payload.error.code;
        }
        return this;
      }
    };
    reviewGuard({ user: { id: "test", role: "CITIZEN" } }, mockRes, () => {});
    assert(forbiddenRoleCaught, "authorizeRoles blocks unauthorized roles with 403");
    assert(forbiddenRoleCode === "FORBIDDEN_ROLE", "Error code is FORBIDDEN_ROLE");

    // 3. Input Validation
    console.log("\n--- 3. Input Validation ---");
    const badIdRes = await request("/api/v1/overlaps/invalid-id/review", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(badIdRes.status === 400, "Non-numeric link ID rejected with 400");
    assert(badIdRes.body?.error?.code === "INVALID_INPUT", "Error code is INVALID_INPUT");

    const missingStatusRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ review_notes: "Only notes provided" })
    });
    assert(missingStatusRes.status === 400, "Missing review_status rejected with 400");
    assert(missingStatusRes.body?.error?.code === "INVALID_INPUT", "Error code is INVALID_INPUT");

    const invalidStatusRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ review_status: "Under Review" })
    });
    assert(invalidStatusRes.status === 400, "Invalid review_status 'Under Review' rejected with 400");

    const suggestedStatusRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ review_status: "Suggested" })
    });
    assert(suggestedStatusRes.status === 400, "Transitioning to 'Suggested' rejected with 400");

    // 4. Missing Record Handling
    console.log("\n--- 4. Missing Record Handling ---");
    const notFoundRes = await request("/api/v1/overlaps/9999999/review", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(notFoundRes.status === 404, "Non-existent link ID rejected with 404");
    assert(notFoundRes.body?.error?.code === "OVERLAP_NOT_FOUND", "Error code is OVERLAP_NOT_FOUND");

    // 5. Cross-Bureau Access Control
    console.log("\n--- 5. Bureau Scoping & Cross-Bureau Access Control ---");
    // Link 1 connects SDC and GRC. QAC Officer should be blocked.
    const crossBureauRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${qacOfficerToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed", review_notes: "QAC trying to confirm" })
    });
    assert(crossBureauRes.status === 403, "QAC Officer blocked from reviewing SDC-GRC overlap with 403");
    assert(crossBureauRes.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS", "Error code is FORBIDDEN_BUREAU_ACCESS");

    // 6. Successful Review Transition to Confirmed by Participant Bureau Official
    console.log("\n--- 6. Successful Review: Confirmed ---");
    const confirmRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sdcOfficerToken}`
      },
      body: JSON.stringify({
        review_status: "Confirmed",
        review_notes: "Cross-bureau overlap verified between SDC and GRC hostels"
      })
    });
    assert(confirmRes.status === 200, "SDC Officer successfully reviews SDC-GRC overlap (200 OK)");
    assert(confirmRes.body?.success === true, "Response uses { success: true } envelope");
    assert(confirmRes.body?.data?.review_status === "Confirmed", "review_status updated to Confirmed");
    assert(confirmRes.body?.data?.requires_official_review === false, "requires_official_review is false after review");
    assert(confirmRes.body?.data?.review_notes?.includes("verified between SDC and GRC"), "review_notes recorded in response");
    assert(Boolean(confirmRes.body?.data?.reviewed_at), "reviewed_at timestamp is populated");

    // Verify database row in complaint_links
    const dbCheckLink1 = await dbClient.query("SELECT * FROM complaint_links WHERE id = $1;", [tempLinkId1]);
    const link1Row = dbCheckLink1.rows[0];
    assert(link1Row.review_status === "Confirmed", "Database review_status is Confirmed");
    assert(Boolean(link1Row.reviewed_by), "Database reviewed_by is populated");
    assert(Boolean(link1Row.reviewed_at), "Database reviewed_at is populated");

    // 7. Audit Logging in complaint_actions
    console.log("\n--- 7. Audit Logging in complaint_actions ---");
    const actionCaseA = await dbClient.query(
      "SELECT * FROM complaint_actions WHERE complaint_id = 'CMP-TEST-REV-1' ORDER BY created_at DESC LIMIT 1;"
    );
    const actionCaseB = await dbClient.query(
      "SELECT * FROM complaint_actions WHERE complaint_id = 'CMP-TEST-REV-2' ORDER BY created_at DESC LIMIT 1;"
    );

    assert(actionCaseA.rows.length === 1, "Audit action recorded for complaint A");
    assert(actionCaseA.rows[0]?.action_type === "OVERLAP_LINKED", "action_type is OVERLAP_LINKED for Confirmed status");
    assert(actionCaseA.rows[0]?.notes?.includes("verified between SDC and GRC"), "Audit action includes reviewer notes");
    assert(actionCaseA.rows[0]?.actor_name === "Student Development Cell Officer", "actor_name matches reviewer");
    assert(actionCaseA.rows[0]?.details?.matched_complaint_id === "CMP-TEST-REV-2", "details contains matched_complaint_id");

    assert(actionCaseB.rows.length === 1, "Audit action recorded for complaint B");
    assert(actionCaseB.rows[0]?.action_type === "OVERLAP_LINKED", "action_type for complaint B is OVERLAP_LINKED");
    assert(actionCaseB.rows[0]?.details?.matched_complaint_id === "CMP-TEST-REV-1", "details for complaint B points to complaint A");

    // 8. Prevent Invalid Status Transitions (Re-reviewing)
    console.log("\n--- 8. Prevent Invalid Status Transitions ---");
    const reReviewRes = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sdcOfficerToken}`
      },
      body: JSON.stringify({ review_status: "Dismissed" })
    });
    assert(reReviewRes.status === 409, "Re-reviewing an already-confirmed overlap rejected with 409");
    assert(reReviewRes.body?.error?.code === "INVALID_STATUS_TRANSITION", "Error code is INVALID_STATUS_TRANSITION");

    // 9. Successful Review Transition to Dismissed
    console.log("\n--- 9. Successful Review: Dismissed ---");
    const dismissRes = await request(`/api/v1/overlaps/${tempLinkId2}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        review_status: "Dismissed",
        review_notes: "Reviewed and dismissed: complaints are distinct matters"
      })
    });
    assert(dismissRes.status === 200, "SUPER_ADMIN successfully dismisses overlap (200 OK)");
    assert(dismissRes.body?.data?.review_status === "Dismissed", "review_status updated to Dismissed");
    assert(dismissRes.body?.data?.requires_official_review === false, "requires_official_review is false");

    const dismissActionCase = await dbClient.query(
      "SELECT * FROM complaint_actions WHERE complaint_id = 'CMP-TEST-REV-3' ORDER BY created_at DESC LIMIT 1;"
    );
    assert(dismissActionCase.rows.length === 1, "Audit action recorded for dismissed complaint");
    assert(dismissActionCase.rows[0]?.action_type === "OVERLAP_REVIEWED", "action_type is OVERLAP_REVIEWED for Dismissed status");

    // 10. HTTP Route Alias Compatibility (POST /:id/review and PATCH /:id)
    console.log("\n--- 10. HTTP Route Alias Compatibility ---");
    const postRouteCheck = await request(`/api/v1/overlaps/${tempLinkId1}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sdcOfficerToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(postRouteCheck.status === 409, "POST /:id/review reaches handler and enforces transition guards");

    const patchDirectCheck = await request(`/api/v1/overlaps/${tempLinkId1}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sdcOfficerToken}`
      },
      body: JSON.stringify({ review_status: "Confirmed" })
    });
    assert(patchDirectCheck.status === 409, "PATCH /:id reaches handler and enforces transition guards");

  } finally {
    // 11. Cleanup Test Fixtures from Database
    console.log("\n--- 11. Database Teardown & Baseline Restoration ---");
    if (tempLinkId1) {
      await dbClient.query("DELETE FROM complaint_links WHERE id = $1;", [tempLinkId1]);
    }
    if (tempLinkId2) {
      await dbClient.query("DELETE FROM complaint_links WHERE id = $1;", [tempLinkId2]);
    }
    await dbClient.query(`
      DELETE FROM complaint_actions
      WHERE complaint_id IN ('CMP-TEST-REV-1', 'CMP-TEST-REV-2', 'CMP-TEST-REV-3');
    `);
    await dbClient.query(`
      DELETE FROM complaints
      WHERE complaint_id IN ('CMP-TEST-REV-1', 'CMP-TEST-REV-2', 'CMP-TEST-REV-3');
    `);

    // Verify test fixture teardown and baseline preservation
    const remainingTestComplaints = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM complaints WHERE complaint_id LIKE 'CMP-TEST-REV-%';"
    );
    assert(remainingTestComplaints.rows[0]?.count === 0, "All test complaints cleanly removed from database");

    const remainingTestLinks = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM complaint_links WHERE complaint_id_a LIKE 'CMP-TEST-%' OR complaint_id_b LIKE 'CMP-TEST-%';"
    );
    assert(remainingTestLinks.rows[0]?.count === 0, "All test complaint_links cleanly removed from database");

    const baselineCasesRes = await dbClient.query(
      "SELECT COUNT(*)::int AS count FROM complaints WHERE complaint_id IN ('CMP-1001', 'CMP-1002', 'CMP-1003', 'CMP-1004', 'CMP-1005');"
    );
    assert(baselineCasesRes.rows[0]?.count === 5, "All 5 baseline complaints preserved in database");

    dbClient.release();
  }

  console.log("\n========================================");
  console.log(`Overlap Review Tests: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

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
