/**
 * Focused Integration Test Suite for Complaint Overlap Enrichment
 *
 * Verifies:
 * 1. GET /api/v1/complaints includes `has_overlap` (boolean) and `matched_case_ids` (array of strings)
 * 2. Reciprocal matches:
 *    - CMP-1001 has_overlap === true, matched_case_ids includes 'CMP-1002'
 *    - CMP-1002 has_overlap === true, matched_case_ids includes 'CMP-1001'
 *    - CMP-1003 has_overlap === true, matched_case_ids includes 'CMP-1005'
 *    - CMP-1005 has_overlap === true, matched_case_ids includes 'CMP-1003'
 * 3. Non-overlapping complaints:
 *    - CMP-1004 has_overlap === false, matched_case_ids === []
 * 4. GET /api/v1/complaints/:id detail endpoint:
 *    - CMP-1001 detail has_overlap === true, matched_case_ids includes 'CMP-1002'
 *    - CMP-1004 detail has_overlap === false, matched_case_ids === []
 * 5. Review status behavior:
 *    - Excludes 'Dismissed' links, includes 'Suggested' and 'Confirmed' links
 * 6. Bureau isolation & Access Control:
 *    - SDC Officer querying complaints only receives Student Development Cell cases
 *    - SDC Officer accessing CMP-1004 (Quality Assurance Cell) detail is blocked with 403 FORBIDDEN_BUREAU_ACCESS
 *    - Unauthenticated requests blocked with 401 AUTH_TOKEN_MISSING
 * 7. Response envelope integrity:
 *    - List endpoint retains { success: true, data: [...], meta: {...} }
 *    - Detail endpoint retains { success: true, data: {...} }
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
  console.log("=== Complaint Overlap Enrichment Verification Suite ===\n");

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error("FATAL: BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_STAFF_PASSWORD must be configured in backend/.env");
    process.exit(1);
  }

  // 1. Unauthenticated Deny-by-Default
  console.log("--- 1. Deny-by-Default: Unauthenticated Requests ---");
  const unauthList = await request("/api/v1/complaints");
  assert(
    unauthList.status === 401 && unauthList.body?.error?.code === "AUTH_TOKEN_MISSING",
    "Blocked unauthenticated GET /api/v1/complaints with 401 AUTH_TOKEN_MISSING"
  );

  const unauthDetail = await request("/api/v1/complaints/CMP-1001");
  assert(
    unauthDetail.status === 401 && unauthDetail.body?.error?.code === "AUTH_TOKEN_MISSING",
    "Blocked unauthenticated GET /api/v1/complaints/CMP-1001 with 401 AUTH_TOKEN_MISSING"
  );

  // Authenticate Admin and Officers
  const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
  const sdcToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);

  // 2. Response Envelope & Overlap Fields on List Endpoint
  console.log("\n--- 2. List Endpoint Response Envelope & Overlap Contract ---");
  const listRes = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });

  assert(listRes.status === 200, "GET /api/v1/complaints returns 200 OK");
  assert(listRes.body?.success === true, "Response uses { success: true } envelope");
  assert(Array.isArray(listRes.body?.data), "data is an array of complaint records");
  assert(typeof listRes.body?.meta?.total === "number", "meta envelope contains total count");

  const complaints = listRes.body.data;
  assert(
    complaints.length >= 5 &&
    ["CMP-1001", "CMP-1002", "CMP-1003", "CMP-1004", "CMP-1005"].every((id) => complaints.some((c) => c.complaint_id === id)),
    "Admin receives all baseline complaints across bureaus"
  );

  let allHaveValidOverlapFields = true;
  for (const c of complaints) {
    if (typeof c.has_overlap !== "boolean" || !Array.isArray(c.matched_case_ids)) {
      allHaveValidOverlapFields = false;
      break;
    }
  }
  assert(allHaveValidOverlapFields, "Every complaint record has boolean 'has_overlap' and array 'matched_case_ids'");

  // 3. Reciprocal Pair Overlap Verification
  console.log("\n--- 3. Reciprocal Overlap Link Assertions ---");
  const caseMap = new Map(complaints.map(c => [c.complaint_id, c]));

  // Pair 1: CMP-1001 <-> CMP-1002
  const c1001 = caseMap.get("CMP-1001");
  const c1002 = caseMap.get("CMP-1002");

  assert(c1001?.has_overlap === true, "CMP-1001 has_overlap === true");
  assert(
    c1001?.matched_case_ids.includes("CMP-1002"),
    "CMP-1001 matched_case_ids includes 'CMP-1002'"
  );

  assert(c1002?.has_overlap === true, "CMP-1002 has_overlap === true (reciprocal)");
  assert(
    c1002?.matched_case_ids.includes("CMP-1001"),
    "CMP-1002 matched_case_ids includes 'CMP-1001' (reciprocal)"
  );

  // Pair 2: CMP-1003 <-> CMP-1005
  const c1003 = caseMap.get("CMP-1003");
  const c1005 = caseMap.get("CMP-1005");

  assert(c1003?.has_overlap === true, "CMP-1003 has_overlap === true");
  assert(
    c1003?.matched_case_ids.includes("CMP-1005"),
    "CMP-1003 matched_case_ids includes 'CMP-1005'"
  );

  assert(c1005?.has_overlap === true, "CMP-1005 has_overlap === true (reciprocal)");
  assert(
    c1005?.matched_case_ids.includes("CMP-1003"),
    "CMP-1005 matched_case_ids includes 'CMP-1003' (reciprocal)"
  );

  // Unrelated Case: CMP-1004
  const c1004 = caseMap.get("CMP-1004");
  assert(c1004?.has_overlap === false, "CMP-1004 has_overlap === false");
  assert(
    Array.isArray(c1004?.matched_case_ids) && c1004.matched_case_ids.length === 0,
    "CMP-1004 matched_case_ids is empty array []"
  );

  // 4. Detail Endpoint Verification
  console.log("\n--- 4. Detail Endpoint (GET /api/v1/complaints/:id) ---");
  const d1001 = await request("/api/v1/complaints/CMP-1001", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(d1001.status === 200, "GET /api/v1/complaints/CMP-1001 returns 200 OK");
  assert(d1001.body?.success === true, "Detail response envelope has success: true");
  assert(d1001.body?.data?.has_overlap === true, "CMP-1001 detail has_overlap is true");
  assert(
    d1001.body?.data?.matched_case_ids.includes("CMP-1002"),
    "CMP-1001 detail matched_case_ids includes 'CMP-1002'"
  );

  const d1004 = await request("/api/v1/complaints/CMP-1004", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(d1004.status === 200, "GET /api/v1/complaints/CMP-1004 returns 200 OK");
  assert(d1004.body?.data?.has_overlap === false, "CMP-1004 detail has_overlap is false");
  assert(
    Array.isArray(d1004.body?.data?.matched_case_ids) && d1004.body?.data?.matched_case_ids.length === 0,
    "CMP-1004 detail matched_case_ids is empty array []"
  );

  // 5. Bureau Access Control & Isolation
  console.log("\n--- 5. Bureau Scoping and Access Isolation ---");
  const sdcList = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(sdcList.status === 200, "SDC Officer receives 200 OK on /api/v1/complaints");
  assert(sdcList.body?.data?.length >= 2, "SDC Officer query returns SDC complaints");
  const sdcIds = sdcList.body.data.map(c => c.complaint_id);
  assert(
    ["CMP-1001", "CMP-1003"].every((id) => sdcIds.includes(id)),
    "SDC complaints include baseline CMP-1001 and CMP-1003"
  );
  assert(
    sdcList.body.data.every(c => c.bureau === "Student Development Cell"),
    "SDC query strictly returns Student Development Cell complaints only"
  );
  assert(
    ["CMP-1001", "CMP-1003"].every((id) => sdcList.body.data.find(c => c.complaint_id === id)?.has_overlap === true),
    "Both baseline SDC complaints retain has_overlap === true in scoped query"
  );

  // SDC Officer blocked from accessing QAC case detail
  const sdcBlockedDetail = await request("/api/v1/complaints/CMP-1004", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcBlockedDetail.status === 403 && sdcBlockedDetail.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "SDC Officer blocked from QAC complaint CMP-1004 detail with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  // 6. Review Status Filter Logic & Isolated Transaction Dismissed Link Verification
  console.log("\n--- 6. Isolated Transaction Test: Dismissed-Link Verification ---");
  const { getPool, query: dbQuery } = await import("../src/config/db.js");
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 6.1 Insert temporary test complaints within isolated transaction
    await client.query(`
      INSERT INTO complaints (complaint_id, institution_id, category, title, description, bureau, originating_bureau, status, priority, due_date)
      VALUES
        ('CMP-TEMP-DISM-1', 'a0000000-0000-0000-0000-000000000204', 'Academics', 'Temp 1', 'Desc 1', 'Student Development Cell', 'Student Development Cell', 'Open', 'Low', NOW() + INTERVAL '30 days'),
        ('CMP-TEMP-DISM-2', 'a0000000-0000-0000-0000-000000000204', 'Academics', 'Temp 2', 'Desc 2', 'Grievance Redressal Cell', 'Grievance Redressal Cell', 'Open', 'Low', NOW() + INTERVAL '30 days');
    `);

    // 6.2 Insert a complaint_link with review_status = 'Dismissed'
    await client.query(`
      INSERT INTO complaint_links (complaint_id_a, complaint_id_b, similarity_score, match_reasons, review_status)
      VALUES ('CMP-TEMP-DISM-1', 'CMP-TEMP-DISM-2', 0.8200, '["same category"]'::jsonb, 'Dismissed');
    `);

    // 6.3 Run the exact listSql subquery used in complaintService.js
    const dListRes = await client.query(`
      SELECT
        c.complaint_id,
        COALESCE(o.has_overlap, false) AS has_overlap,
        COALESCE(o.matched_case_ids, ARRAY[]::TEXT[]) AS matched_case_ids
      FROM complaints c
      LEFT JOIN (
        SELECT
          complaint_id,
          true AS has_overlap,
          ARRAY_AGG(matched_id ORDER BY matched_id) AS matched_case_ids
        FROM (
          SELECT complaint_id_a AS complaint_id, complaint_id_b AS matched_id
          FROM complaint_links
          WHERE review_status IN ('Suggested', 'Confirmed')
          UNION ALL
          SELECT complaint_id_b AS complaint_id, complaint_id_a AS matched_id
          FROM complaint_links
          WHERE review_status IN ('Suggested', 'Confirmed')
        ) links
        GROUP BY complaint_id
      ) o ON c.complaint_id = o.complaint_id
      WHERE c.complaint_id IN ('CMP-TEMP-DISM-1', 'CMP-TEMP-DISM-2')
      ORDER BY c.complaint_id ASC;
    `);

    const row1 = dListRes.rows[0];
    const row2 = dListRes.rows[1];

    assert(
      row1?.complaint_id === "CMP-TEMP-DISM-1" && row1.has_overlap === false,
      "Complaint linked ONLY through Dismissed relationship returns has_overlap: false (case A)"
    );
    assert(
      Array.isArray(row1?.matched_case_ids) && row1.matched_case_ids.length === 0,
      "Complaint linked ONLY through Dismissed relationship returns matched_case_ids: [] (case A)"
    );
    assert(
      row2?.complaint_id === "CMP-TEMP-DISM-2" && row2.has_overlap === false,
      "Complaint linked ONLY through Dismissed relationship returns has_overlap: false (case B, reciprocal)"
    );
    assert(
      Array.isArray(row2?.matched_case_ids) && row2.matched_case_ids.length === 0,
      "Complaint linked ONLY through Dismissed relationship returns matched_case_ids: [] (case B, reciprocal)"
    );

    // 6.4 Now transition the link to 'Confirmed' within the transaction to confirm positive detection
    await client.query(`
      UPDATE complaint_links
      SET review_status = 'Confirmed'
      WHERE complaint_id_a = 'CMP-TEMP-DISM-1' AND complaint_id_b = 'CMP-TEMP-DISM-2';
    `);

    const confirmedRes = await client.query(`
      SELECT
        c.complaint_id,
        COALESCE(o.has_overlap, false) AS has_overlap,
        COALESCE(o.matched_case_ids, ARRAY[]::TEXT[]) AS matched_case_ids
      FROM complaints c
      LEFT JOIN (
        SELECT
          complaint_id,
          true AS has_overlap,
          ARRAY_AGG(matched_id ORDER BY matched_id) AS matched_case_ids
        FROM (
          SELECT complaint_id_a AS complaint_id, complaint_id_b AS matched_id
          FROM complaint_links
          WHERE review_status IN ('Suggested', 'Confirmed')
          UNION ALL
          SELECT complaint_id_b AS complaint_id, complaint_id_a AS matched_id
          FROM complaint_links
          WHERE review_status IN ('Suggested', 'Confirmed')
        ) links
        GROUP BY complaint_id
      ) o ON c.complaint_id = o.complaint_id
      WHERE c.complaint_id = 'CMP-TEMP-DISM-1';
    `);

    assert(
      confirmedRes.rows[0]?.has_overlap === true && confirmedRes.rows[0]?.matched_case_ids.includes("CMP-TEMP-DISM-2"),
      "Transitioning same link to 'Confirmed' dynamically activates has_overlap: true and populates matched_case_ids"
    );

  } finally {
    // 6.5 Safe rollback: zero mutations in live database
    await client.query("ROLLBACK;");
    client.release();
  }

  // 6.6 Verify database cleanliness post-rollback
  const postRollbackRes = await dbQuery(`
    SELECT COUNT(*)::INT as count FROM complaints WHERE complaint_id LIKE 'CMP-TEMP-DISM%';
  `);
  assert(
    postRollbackRes.rows[0]?.count === 0,
    "Post-test verification: temporary transaction was completely rolled back with zero database mutations"
  );

  console.log("\n========================================");
  console.log(`Complaint Overlap Tests: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  const { closePool } = await import("../src/config/db.js");
  await closePool();

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(async (err) => {
  try {
    const { closePool } = await import("../src/config/db.js");
    await closePool();
  } catch {}
  console.error("Test execution failed:", err);
  process.exit(1);
});
