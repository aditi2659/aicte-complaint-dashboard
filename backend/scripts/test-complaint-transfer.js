/**
 * Verification Suite for Persistent Complaint Bureau Transfers API
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Auditor 403 AUDITOR_READ_ONLY)
 * 3. Comprehensive input validation (missing reason, missing bureau, invalid bureau, missing complaint)
 * 4. Same-bureau transfer rejection (400 INVALID_INPUT)
 * 5. Bureau-level isolation & cross-bureau restrictions (scoped officer transferring other bureau -> 403 FORBIDDEN_BUREAU_ACCESS)
 * 6. Successful bureau transfers by scoped staff and Super Admin (HTTP 200)
 * 7. Persistence in complaint_transfers table (status = 'Completed', from_bureau, to_bureau, reason, requested_by)
 * 8. Atomic audit logging in complaint_actions (action_type = 'TRANSFER_RESOLVED')
 * 9. Terminal-state transfer prevention (cannot transfer Resolved / Closed cases -> 409 INVALID_STATUS_TRANSITION)
 * 10. Complete database teardown and baseline restoration
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getPool } from "../src/config/db.js";
import { transferComplaint } from "../src/services/complaintService.js";

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
  console.log("=== Complaint Bureau Transfers API Verification Suite ===\n");

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

  // Baseline database snapshot verification
  const preCheck = await pool.query(
    "SELECT complaint_id, bureau, originating_bureau, status FROM complaints WHERE complaint_id IN ('CMP-1002', 'CMP-1003') ORDER BY complaint_id;"
  );
  assert(preCheck.rows.length === 2, "Test subject complaints CMP-1002 and CMP-1003 present in database");

  // Step 0: Login tokens for roles
  const superAdminToken = await loginUser("admin@aicte.gov.in", adminPassword);
  const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
  const grcOfficerToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);
  const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

  // 1. Authentication & Role Restrictions
  console.log("\n--- 1. Authentication & Role Restrictions ---");

  const unauthRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "Handover required"
    })
  });
  assert(unauthRes.status === 401, "Unauthenticated POST /transfer rejected with 401 AUTH_TOKEN_MISSING", unauthRes);
  assert(unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING", "Error code is AUTH_TOKEN_MISSING");

  const auditorRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auditorToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "Audit transfer"
    })
  });
  assert(auditorRes.status === 403, "Auditor role cannot transfer complaints (403 AUDITOR_READ_ONLY)", auditorRes);
  assert(auditorRes.body?.error?.code === "AUDITOR_READ_ONLY", "Error code is AUDITOR_READ_ONLY");

  // 2. Comprehensive Input Validation
  console.log("\n--- 2. Input Validation ---");

  const emptyReasonRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "   "
    })
  });
  assert(emptyReasonRes.status === 400, "Empty transfer reason rejected with 400 INVALID_INPUT", emptyReasonRes);

  const missingBureauRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      reason: "Jurisdiction change"
    })
  });
  assert(missingBureauRes.status === 400, "Missing destination bureau rejected with 400 INVALID_INPUT", missingBureauRes);

  const invalidBureauRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Unknown Ministry Division",
      reason: "Jurisdiction change"
    })
  });
  assert(invalidBureauRes.status === 400, "Unrecognized destination bureau rejected with 400 INVALID_INPUT", invalidBureauRes);

  const missingCmpRes = await request("/api/v1/complaints/CMP-9999/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "Non-existent complaint transfer"
    })
  });
  assert(missingCmpRes.status === 404, "Non-existent complaint ID rejected with 404 COMPLAINT_NOT_FOUND", missingCmpRes);

  // 3. Same-Bureau Transfer Rejection
  console.log("\n--- 3. Same-Bureau Transfer Rejection ---");

  const sameBureauRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Student Development Cell",
      reason: "Redundant transfer attempt"
    })
  });
  assert(sameBureauRes.status === 400, "Transfer to identical bureau rejected with 400 INVALID_INPUT", sameBureauRes);
  assert(
    sameBureauRes.body?.error?.message?.includes("already assigned"),
    "Rejection message clearly states complaint is already assigned to target bureau"
  );

  // 4. Bureau-Level Authorization & Cross-Bureau Denial
  console.log("\n--- 4. Bureau-Level Authorization & Cross-Bureau Denial ---");

  // CMP-1002 belongs to Grievance Redressal Cell; SDC Officer must be blocked
  const crossBureauRes = await request("/api/v1/complaints/CMP-1002/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "Unauthorized transfer attempt across bureaus"
    })
  });
  assert(crossBureauRes.status === 403, "SDC Officer blocked from transferring GRC complaint CMP-1002 (403 FORBIDDEN_BUREAU_ACCESS)", crossBureauRes);

  // Scoped officer with unassigned bureau should be blocked
  try {
    await transferComplaint("CMP-1003", { destination_bureau: "Approval Bureau", reason: "Testing null bureau" }, {
      id: "00000000-0000-0000-0000-000000000099",
      role: "BUREAU_OFFICER",
      bureau: null
    });
    assert(false, "Scoped officer with null bureau should throw 403 FORBIDDEN_BUREAU_ACCESS");
  } catch (err) {
    assert(err.code === "FORBIDDEN_BUREAU_ACCESS", "Scoped officer with null bureau cannot transfer complaints (403 FORBIDDEN_BUREAU_ACCESS)");
  }

  // 5. Successful Bureau Transfers & Atomic Persistence
  console.log("\n--- 5. Successful Bureau Transfers & Atomic Persistence ---");

  // SDC Officer transfers CMP-1003 to Approval Bureau using code 'AB'
  const transferRes = await request("/api/v1/complaints/CMP-1003/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sdcOfficerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "AB",
      reason: "Approval freeze recommended due to non-compliance",
      remarks: "Official handover notes from SDC inspection team."
    })
  });

  assert(transferRes.status === 200, "SDC Officer successfully transferred CMP-1003 using bureau code 'AB' (HTTP 200)", transferRes);
  assert(transferRes.body?.success === true, "Response uses { success: true } envelope");
  assert(transferRes.body?.data?.bureau === "Approval Bureau", "Complaint bureau updated to 'Approval Bureau'");
  assert(transferRes.body?.data?.status === "Transferred", "Complaint status updated to 'Transferred'");
  assert(transferRes.body?.data?.originating_bureau === "Student Development Cell", "Originating bureau preserved as 'Student Development Cell'");

  // Super Admin transfers CMP-1002 to Quality Assurance Cell using full name
  const adminTransferRes = await request("/api/v1/complaints/CMP-1002/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Quality Assurance Cell",
      reason: "Academic quality deficiency warrants QAC oversight",
      remarks: "Direct handover instructed by AICTE Central Administration."
    })
  });

  assert(adminTransferRes.status === 200, "Super Admin successfully transferred CMP-1002 to Quality Assurance Cell (HTTP 200)", adminTransferRes);
  assert(adminTransferRes.body?.data?.bureau === "Quality Assurance Cell", "CMP-1002 bureau updated to 'Quality Assurance Cell'");
  assert(adminTransferRes.body?.data?.status === "Transferred", "CMP-1002 status updated to 'Transferred'");

  // 6. Database Verification: complaint_transfers & complaint_actions
  console.log("\n--- 6. Database Verification (complaint_transfers & complaint_actions) ---");

  const dbTransfers = await pool.query(
    "SELECT id, complaint_id, from_bureau, to_bureau, reason, status, notes, requested_by FROM complaint_transfers WHERE complaint_id = 'CMP-1003' ORDER BY created_at DESC LIMIT 1;"
  );
  assert(dbTransfers.rows.length === 1, "Transfer record created in complaint_transfers table");
  const transferRow = dbTransfers.rows[0];
  assert(transferRow.from_bureau === "Student Development Cell", "complaint_transfers.from_bureau is 'Student Development Cell'");
  assert(transferRow.to_bureau === "Approval Bureau", "complaint_transfers.to_bureau is 'Approval Bureau'");
  assert(transferRow.status === "Completed", "complaint_transfers.status is 'Completed'");
  assert(transferRow.notes === "Official handover notes from SDC inspection team.", "complaint_transfers.notes preserves handover directives");

  const dbActions = await pool.query(
    "SELECT id, action_type, action, notes, actor_name, details FROM complaint_actions WHERE complaint_id = 'CMP-1003' AND action_type = 'TRANSFER_RESOLVED' ORDER BY created_at DESC LIMIT 1;"
  );
  assert(dbActions.rows.length === 1, "TRANSFER_RESOLVED audit action recorded in complaint_actions table");
  const actionRow = dbActions.rows[0];
  assert(actionRow.actor_name === "Student Development Cell Officer", "Audit action recorded actor name accurately");
  assert(actionRow.details?.from_bureau === "Student Development Cell", "Audit action details recorded from_bureau");
  assert(actionRow.details?.to_bureau === "Approval Bureau", "Audit action details recorded to_bureau");
  assert(actionRow.details?.new_status === "Transferred", "Audit action details recorded new_status as 'Transferred'");

  // 7. Terminal State & Disposed Guard
  console.log("\n--- 7. Terminal State Rules & Disposed Cases Guard ---");

  // Temporarily set CMP-1004 to 'Closed' to test terminal transition guard
  await pool.query("UPDATE complaints SET status = 'Closed' WHERE complaint_id = 'CMP-1004';");

  const terminalRes = await request("/api/v1/complaints/CMP-1004/transfer", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      destination_bureau: "Approval Bureau",
      reason: "Attempting to transfer closed case"
    })
  });

  assert(terminalRes.status === 409, "Transfer out of terminal status 'Closed' rejected with 409 INVALID_STATUS_TRANSITION", terminalRes);
  assert(terminalRes.body?.error?.code === "INVALID_STATUS_TRANSITION", "Error code is INVALID_STATUS_TRANSITION");

  // Restore CMP-1004 back to 'Assigned'
  await pool.query("UPDATE complaints SET status = 'Assigned' WHERE complaint_id = 'CMP-1004';");

  // 8. Database Teardown & Baseline Restoration
  console.log("\n--- 8. Database Teardown & Baseline Restoration ---");

  // Restore CMP-1002 and CMP-1003 to baseline
  await pool.query(
    "UPDATE complaints SET bureau = 'Grievance Redressal Cell', status = 'Open', updated_at = NOW() WHERE complaint_id = 'CMP-1002';"
  );
  await pool.query(
    "UPDATE complaints SET bureau = 'Student Development Cell', status = 'Open', updated_at = NOW() WHERE complaint_id = 'CMP-1003';"
  );
  await pool.query(
    "UPDATE complaints SET bureau = 'Quality Assurance Cell', status = 'Assigned', updated_at = NOW() WHERE complaint_id = 'CMP-1004';"
  );

  // Clean test transfers and actions
  await pool.query("DELETE FROM complaint_transfers WHERE complaint_id IN ('CMP-1002', 'CMP-1003', 'CMP-1004');");
  await pool.query(
    "DELETE FROM complaint_actions WHERE complaint_id IN ('CMP-1002', 'CMP-1003', 'CMP-1004') AND action_type = 'TRANSFER_RESOLVED';"
  );

  // Verify baseline
  const postCheck = await pool.query(
    "SELECT complaint_id, bureau, status FROM complaints WHERE complaint_id IN ('CMP-1002', 'CMP-1003') ORDER BY complaint_id;"
  );
  assert(
    postCheck.rows[0].bureau === "Grievance Redressal Cell" && postCheck.rows[0].status === "Open",
    "CMP-1002 cleanly restored to GRC / Open"
  );
  assert(
    postCheck.rows[1].bureau === "Student Development Cell" && postCheck.rows[1].status === "Open",
    "CMP-1003 cleanly restored to SDC / Open"
  );

  const transferCountCheck = await pool.query(
    "SELECT COUNT(*) FROM complaint_transfers WHERE complaint_id IN ('CMP-1002', 'CMP-1003');"
  );
  assert(parseInt(transferCountCheck.rows[0].count, 10) === 0, "All test transfer records cleaned up from database");

  console.log("\n==================================================");
  console.log(`Complaint Bureau Transfers Results: ${passed} passed, ${failed} failed`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  await pool.end();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
