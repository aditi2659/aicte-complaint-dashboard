/**
 * Verification Suite for Persistent Complaint Status Updates API
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Auditor 403 AUDITOR_READ_ONLY)
 * 3. Comprehensive input validation (missing remarks, missing status, invalid status, missing complaint)
 * 4. Bureau-level isolation & cross-bureau restrictions (scoped officer updating other bureau -> 403 FORBIDDEN_BUREAU_ACCESS)
 * 5. Successful status transitions by scoped staff and Super Admin (HTTP 200)
 * 6. Escalation flag handling (ESCALATED sets is_escalated = true and status = Under Review)
 * 7. Terminal-state transition prevention (cannot transition out of Resolved / Closed -> 409 INVALID_STATUS_TRANSITION)
 * 8. Redundant transition prevention (transition to identical status -> 409 INVALID_STATUS_TRANSITION)
 * 9. Atomic audit logging in complaint_actions (action_type = 'STATUS_CHANGE', previous_status, new_status, remarks)
 * 10. Complete database teardown and baseline restoration
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.NODE_ENV = process.env.NODE_ENV || "test";

import { getPool } from "../src/config/db.js";
import { updateComplaintStatus } from "../src/services/complaintService.js";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:4000";

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
  console.log("=== Complaint Status Updates API Verification Suite ===\n");

  const pool = getPool();
  if (!pool) {
    throw new Error("Database pool is not available.");
  }
  const dbClient = await pool.connect();

  // Snapshot original baseline status of CMP-1001, CMP-1002, CMP-1003
  const baselineCasesRes = await dbClient.query(`
    SELECT complaint_id, status, is_escalated
    FROM complaints
    WHERE complaint_id IN ('CMP-1001', 'CMP-1002', 'CMP-1003');
  `);
  const baselineMap = {};
  for (const row of baselineCasesRes.rows) {
    baselineMap[row.complaint_id] = { status: row.status, is_escalated: row.is_escalated };
  }

  const testActionIds = [];

  try {
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AICTE_Admin_9aF8c3e210b48d7120";
    const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD || "AICTE_Staff_7bE6d4c120f39a8231";

    const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
    const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
    const grcOfficerToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);
    const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

    console.log("--- 1. Authentication & Role Restrictions ---");

    // 1.1 Unauthenticated request rejected
    const unauthRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In Progress", remarks: "Hearing conducted" })
    });
    assert(
      unauthRes.status === 401 && unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING",
      "Unauthenticated PATCH /status rejected with 401 AUTH_TOKEN_MISSING"
    );

    // 1.2 Auditor role mutation blocked
    const auditorRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auditorToken}`
      },
      body: JSON.stringify({ status: "In Progress", remarks: "Auditor attempting status change" })
    });
    assert(
      auditorRes.status === 403 && auditorRes.body?.error?.code === "AUDITOR_READ_ONLY",
      "Auditor role cannot update complaint status (403 AUDITOR_READ_ONLY)",
      auditorRes.body
    );

    console.log("\n--- 2. Input Validation ---");

    // 2.1 Missing remarks
    const noRemarksRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "In Progress", remarks: "   " })
    });
    assert(
      noRemarksRes.status === 400 && noRemarksRes.body?.error?.code === "INVALID_INPUT",
      "Empty remarks rejected with 400 INVALID_INPUT"
    );

    // 2.2 Missing status
    const noStatusRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ remarks: "Mandatory remarks provided" })
    });
    assert(
      noStatusRes.status === 400 && noStatusRes.body?.error?.code === "INVALID_INPUT",
      "Missing status rejected with 400 INVALID_INPUT"
    );

    // 2.3 Invalid / unrecognized status value
    const invalidStatusRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "NonExistentStatus", remarks: "Invalid status test" })
    });
    assert(
      invalidStatusRes.status === 400 && invalidStatusRes.body?.error?.code === "INVALID_INPUT",
      "Unrecognized status rejected with 400 INVALID_INPUT without silent fallback"
    );

    // 2.4 Missing complaint ID
    const notFoundRes = await request("/api/v1/complaints/CMP-9999/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "In Progress", remarks: "Valid remarks" })
    });
    assert(
      notFoundRes.status === 404 && notFoundRes.body?.error?.code === "COMPLAINT_NOT_FOUND",
      "Non-existent complaint ID rejected with 404 COMPLAINT_NOT_FOUND"
    );

    console.log("\n--- 3. Bureau-Level Authorization & Cross-Bureau Denial ---");

    // 3.1 Scoped SDC Officer attempting to update GRC complaint CMP-1002
    const crossBureauRes = await request("/api/v1/complaints/CMP-1002/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        status: "In Progress",
        remarks: "SDC officer attempting to update GRC case"
      })
    });
    assert(
      crossBureauRes.status === 403 && crossBureauRes.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS",
      "SDC Officer blocked from updating GRC complaint CMP-1002 (403 FORBIDDEN_BUREAU_ACCESS)",
      crossBureauRes.body
    );

    // 3.2 Scoped officer with unassigned bureau
    let unassignedBureauCaught = false;
    try {
      await updateComplaintStatus(
        "CMP-1001",
        { status: "In Progress", remarks: "Officer with no bureau" },
        { id: "a0000000-0000-0000-0000-000000000003", email: "nobureau@aicte.gov.in", role: "BUREAU_OFFICER", bureau: null }
      );
    } catch (err) {
      if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) {
        unassignedBureauCaught = true;
      }
    }
    assert(
      unassignedBureauCaught,
      "Scoped officer with null bureau cannot update complaints (403 FORBIDDEN_BUREAU_ACCESS)"
    );

    console.log("\n--- 4. Successful Status Transitions & Atomic Persistence ---");

    // 4.1 SDC Officer updates CMP-1003 (SDC Case, originally Open) to 'In Progress'
    const sdcUpdateRes = await request("/api/v1/complaints/CMP-1003/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        status: "In Progress",
        remarks: "Committee scheduled physical inspection for hostel sanitation"
      })
    });
    assert(
      sdcUpdateRes.status === 200 && sdcUpdateRes.body?.success === true,
      "SDC Officer successfully updated CMP-1003 status to 'In Progress' (HTTP 200)",
      sdcUpdateRes.body
    );
    assert(
      sdcUpdateRes.body?.data?.status === "In Progress",
      "Returned complaint object has updated status 'In Progress'"
    );

    // 4.2 Super Admin updates GRC complaint CMP-1002 (system-wide authorization) using UI status 'UNDER_PROCESS'
    const adminUpdateRes = await request("/api/v1/complaints/CMP-1002/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: "UNDER_PROCESS", // UI alias for Under Review
        remarks: "Central review initiated by Member Secretary"
      })
    });
    assert(
      adminUpdateRes.status === 200 && adminUpdateRes.body?.success === true,
      "Super Admin successfully updated CMP-1002 using UI status 'UNDER_PROCESS' (HTTP 200)",
      adminUpdateRes.body
    );
    assert(
      adminUpdateRes.body?.data?.status === "Under Review",
      "UI status 'UNDER_PROCESS' resolved to DB status 'Under Review'"
    );

    // 4.3 Escalation transition: update CMP-1001 to 'ESCALATED'
    const escalateRes = await request("/api/v1/complaints/CMP-1001/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: "ESCALATED",
        remarks: "Critical breach escalated to Chairman"
      })
    });
    assert(
      escalateRes.status === 200 && escalateRes.body?.success === true,
      "Status update to 'ESCALATED' succeeds (HTTP 200)",
      escalateRes.body
    );
    assert(
      escalateRes.body?.data?.is_escalated === true && escalateRes.body?.data?.status === "Under Review",
      "'ESCALATED' sets is_escalated = true and status = 'Under Review'"
    );

    console.log("\n--- 5. Audit Logging in complaint_actions ---");

    // Inspect complaint_actions for CMP-1003 STATUS_CHANGE
    const actionRes = await dbClient.query(`
      SELECT id, complaint_id, action_type, action, notes, actor_name, details
      FROM complaint_actions
      WHERE complaint_id = 'CMP-1003' AND action_type = 'STATUS_CHANGE'
      ORDER BY id DESC LIMIT 1;
    `);
    assert(
      actionRes.rows.length === 1,
      "STATUS_CHANGE audit action recorded in database for CMP-1003",
      actionRes.rows[0]
    );
    if (actionRes.rows.length > 0) {
      const act = actionRes.rows[0];
      testActionIds.push(act.id);
      assert(
        act.notes === "Committee scheduled physical inspection for hostel sanitation" &&
          act.actor_name === "Student Development Cell Officer",
        "Audit action recorded exact transition remarks and actor name"
      );
      assert(
        act.details?.previous_status === "Open" && act.details?.new_status === "In Progress",
        "Audit action details recorded previous_status ('Open') and new_status ('In Progress')"
      );
    }

    console.log("\n--- 6. Transition Guards & Terminal State Rules ---");

    // 6.1 Redundant transition: attempting to update CMP-1003 to 'In Progress' again
    const dupRes = await request("/api/v1/complaints/CMP-1003/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        status: "In Progress",
        remarks: "Redundant status transition attempt"
      })
    });
    assert(
      dupRes.status === 409 && dupRes.body?.error?.code === "INVALID_STATUS_TRANSITION",
      "Redundant transition to identical status rejected with 409 INVALID_STATUS_TRANSITION"
    );

    // 6.2 Transition to terminal status 'Resolved'
    const resolveRes = await request("/api/v1/complaints/CMP-1003/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        status: "Resolved",
        remarks: "Final compliance verified and case formally resolved"
      })
    });
    assert(
      resolveRes.status === 200 && resolveRes.body?.data?.status === "Resolved",
      "Case successfully transitioned to terminal status 'Resolved'"
    );

    // Capture the audit action id for teardown
    const resActionRes = await dbClient.query(`
      SELECT id FROM complaint_actions WHERE complaint_id = 'CMP-1003' AND action_type = 'STATUS_CHANGE' ORDER BY id DESC LIMIT 1;
    `);
    if (resActionRes.rows.length > 0) testActionIds.push(resActionRes.rows[0].id);

    // 6.3 Attempt to transition out of terminal status 'Resolved' -> 409 INVALID_STATUS_TRANSITION
    const reopenRes = await request("/api/v1/complaints/CMP-1003/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        status: "In Progress",
        remarks: "Attempting to operationalize a resolved case"
      })
    });
    assert(
      reopenRes.status === 409 && reopenRes.body?.error?.code === "INVALID_STATUS_TRANSITION",
      "Transition out of terminal status 'Resolved' rejected with 409 INVALID_STATUS_TRANSITION"
    );

  } finally {
    console.log("\n--- 7. Database Teardown & Baseline Restoration ---");

    // Clean up created test actions
    await dbClient.query(`
      DELETE FROM complaint_actions
      WHERE action_type = 'STATUS_CHANGE' AND complaint_id IN ('CMP-1001', 'CMP-1002', 'CMP-1003');
    `);

    // Restore baseline status and is_escalated flags
    for (const [compId, baseline] of Object.entries(baselineMap)) {
      await dbClient.query(`
        UPDATE complaints
        SET status = $1, is_escalated = $2
        WHERE complaint_id = $3;
      `, [baseline.status, baseline.is_escalated, compId]);
    }

    const checkRestored = await dbClient.query(`
      SELECT complaint_id, status, is_escalated
      FROM complaints
      WHERE complaint_id IN ('CMP-1001', 'CMP-1002', 'CMP-1003')
      ORDER BY complaint_id;
    `);
    const allMatches = checkRestored.rows.every(
      (r) => r.status === baselineMap[r.complaint_id]?.status && r.is_escalated === baselineMap[r.complaint_id]?.is_escalated
    );
    assert(allMatches, "Complaints baseline status and escalation flags cleanly restored in database");

    dbClient.release();
    await pool.end();
  }

  console.log(`\n==================================================`);
  console.log(`Complaint Status Updates Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
