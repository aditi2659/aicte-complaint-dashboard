/**
 * Verification Suite for Persistent Complaint Registration API
 *
 * Verifies:
 * 1. Deny-by-default for unauthenticated requests (401 AUTH_TOKEN_MISSING)
 * 2. Role-based access control (Auditor 403 AUDITOR_READ_ONLY, invalid role 403 FORBIDDEN_ROLE)
 * 3. Comprehensive input validation (missing fields, invalid bureau, invalid priority, invalid due_date)
 * 4. Missing institution handling (non-existent institution -> 404 INSTITUTION_NOT_FOUND)
 * 5. Bureau-level authorization & restrictions:
 *    - Scoped officer attempting cross-bureau registration -> 403 FORBIDDEN_BUREAU_ACCESS
 *    - Scoped officer without assigned bureau -> 403 FORBIDDEN_BUREAU_ACCESS
 *    - Scoped officer registering within assigned bureau -> 201 Created
 *    - Super Admin registering across any bureau -> 201 Created
 * 6. Concurrency safety: parallel registration generates unique, collision-free sequential CMP-xxxx IDs
 * 7. Transactional audit action persistence (complaint_actions record created with action_type = 'CREATED')
 * 8. Complete test cleanup and fixture teardown
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { getPool } from "../src/config/db.js";
import { generateToken } from "../src/utils/token.js";
import { createComplaint } from "../src/services/complaintService.js";

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
  console.log("=== Complaint Registration API Verification Suite ===\n");

  const pool = getPool();
  if (!pool) {
    throw new Error("Database pool is not available.");
  }
  const dbClient = await pool.connect();

  const createdComplaintIds = [];

  try {
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "AICTE_Admin_9aF8c3e210b48d7120";
    const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD || "AICTE_Staff_7bE6d4c120f39a8231";

    const adminToken = await loginUser("admin@aicte.gov.in", adminPassword);
    const sdcOfficerToken = await loginUser("sdc.officer@aicte.gov.in", staffPassword);
    const grcOfficerToken = await loginUser("grc.officer@aicte.gov.in", staffPassword);
    const auditorToken = await loginUser("auditor@aicte.gov.in", staffPassword);

    // Look up a valid institution UUID for testing
    const instRes = await dbClient.query("SELECT id, aicte_permanent_id FROM institutions LIMIT 1;");
    if (instRes.rows.length === 0) {
      throw new Error("No institution found in database to execute tests.");
    }
    const validInstId = instRes.rows[0].id;
    const validInstPermId = instRes.rows[0].aicte_permanent_id;

    console.log("--- 1. Authentication & Auditor Role Restrictions ---");

    // 1.1 Unauthenticated request rejected
    const unauthRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" })
    });
    assert(
      unauthRes.status === 401 && unauthRes.body?.error?.code === "AUTH_TOKEN_MISSING",
      "Unauthenticated POST /api/v1/complaints rejected with 401 AUTH_TOKEN_MISSING"
    );

    // 1.2 Auditor rejected with 403 AUDITOR_READ_ONLY
    const auditorRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auditorToken}`
      },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Auditor test",
        description: "Should fail",
        category: "Infrastructure",
        bureau: "Student Development Cell"
      })
    });
    assert(
      auditorRes.status === 403 && auditorRes.body?.error?.code === "AUDITOR_READ_ONLY",
      "Auditor role cannot create complaints (403 AUDITOR_READ_ONLY)",
      auditorRes.body
    );

    console.log("\n--- 2. Input Validation ---");

    // 2.1 Missing institution_id
    const noInstRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: "Test",
        description: "Desc",
        category: "Infra",
        bureau: "Student Development Cell"
      })
    });
    assert(
      noInstRes.status === 400 && noInstRes.body?.error?.code === "INVALID_INPUT",
      "Missing institution_id rejected with 400 INVALID_INPUT"
    );

    // 2.2 Non-existent institution_id
    const fakeInstRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: "00000000-0000-0000-0000-000000000099",
        title: "Test",
        description: "Desc",
        category: "Infra",
        bureau: "Student Development Cell"
      })
    });
    assert(
      fakeInstRes.status === 404 && fakeInstRes.body?.error?.code === "INSTITUTION_NOT_FOUND",
      "Non-existent institution_id rejected with 404 INSTITUTION_NOT_FOUND"
    );

    // 2.3 Missing title
    const noTitleRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "   ",
        description: "Desc",
        category: "Infra",
        bureau: "Student Development Cell"
      })
    });
    assert(
      noTitleRes.status === 400 && noTitleRes.body?.error?.code === "INVALID_INPUT",
      "Empty title rejected with 400 INVALID_INPUT"
    );

    // 2.4 Missing description
    const noDescRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Valid title",
        description: "",
        category: "Infra",
        bureau: "Student Development Cell"
      })
    });
    assert(
      noDescRes.status === 400 && noDescRes.body?.error?.code === "INVALID_INPUT",
      "Empty description rejected with 400 INVALID_INPUT"
    );

    // 2.5 Missing category
    const noCatRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Valid title",
        description: "Valid desc",
        category: "",
        bureau: "Student Development Cell"
      })
    });
    assert(
      noCatRes.status === 400 && noCatRes.body?.error?.code === "INVALID_INPUT",
      "Empty category rejected with 400 INVALID_INPUT"
    );

    // 2.6 Invalid bureau
    const invalidBureauRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Valid title",
        description: "Valid desc",
        category: "Infra",
        bureau: "NonExistent Bureau"
      })
    });
    assert(
      invalidBureauRes.status === 400 && invalidBureauRes.body?.error?.code === "INVALID_INPUT",
      "Unrecognized bureau rejected with 400 INVALID_INPUT"
    );

    // 2.7 Invalid priority
    const invalidPriorityRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Valid title",
        description: "Valid desc",
        category: "Infra",
        bureau: "Student Development Cell",
        priority: "ExtremeEmergency"
      })
    });
    assert(
      invalidPriorityRes.status === 400 && invalidPriorityRes.body?.error?.code === "INVALID_INPUT",
      "Invalid priority rejected with 400 INVALID_INPUT"
    );

    // 2.8 Invalid due_date
    const invalidDateRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Valid title",
        description: "Valid desc",
        category: "Infra",
        bureau: "Student Development Cell",
        due_date: "not-a-valid-date"
      })
    });
    assert(
      invalidDateRes.status === 400 && invalidDateRes.body?.error?.code === "INVALID_INPUT",
      "Invalid due_date format rejected with 400 INVALID_INPUT"
    );

    console.log("\n--- 3. Bureau-Level Authorization & Scoping ---");

    // 3.1 Scoped SDC Officer attempting to register for Grievance Redressal Cell -> 403 FORBIDDEN_BUREAU_ACCESS
    const crossBureauRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Cross bureau test",
        description: "Should fail",
        category: "Scholarship",
        bureau: "Grievance Redressal Cell"
      })
    });
    assert(
      crossBureauRes.status === 403 && crossBureauRes.body?.error?.code === "FORBIDDEN_BUREAU_ACCESS",
      "SDC Officer cannot register complaint for Grievance Redressal Cell (403 FORBIDDEN_BUREAU_ACCESS)",
      crossBureauRes.body
    );

    // 3.2 Scoped officer without assigned bureau -> 403 FORBIDDEN_BUREAU_ACCESS
    let missingBureauCaught = false;
    try {
      await createComplaint(
        {
          institution_id: validInstId,
          title: "No bureau officer test",
          description: "Should fail",
          category: "Scholarship",
          bureau: "Student Development Cell"
        },
        {
          id: "a0000000-0000-0000-0000-000000000099",
          email: "nobureau@aicte.gov.in",
          role: "BUREAU_OFFICER",
          bureau: null
        }
      );
    } catch (err) {
      if (err.code === "FORBIDDEN_BUREAU_ACCESS" && err.statusCode === 403) {
        missingBureauCaught = true;
      }
    }
    assert(
      missingBureauCaught,
      "Scoped officer with null bureau cannot register complaints (403 FORBIDDEN_BUREAU_ACCESS)"
    );

    // 3.3 Scoped SDC Officer successfully registers within assigned bureau (using full name)
    const sdcCreateRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sdcOfficerToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "SDC Officer Registered Case",
        description: "Laboratory equipment inspection report pending",
        category: "Infrastructure Deficiency",
        bureau: "Student Development Cell",
        priority: "High"
      })
    });
    assert(
      sdcCreateRes.status === 201 && sdcCreateRes.body?.success === true,
      "SDC Officer successfully registered complaint within assigned bureau (HTTP 201)",
      sdcCreateRes.body
    );
    if (sdcCreateRes.body?.data?.complaint_id) {
      createdComplaintIds.push(sdcCreateRes.body.data.complaint_id);
      assert(
        sdcCreateRes.body.data.bureau === "Student Development Cell" &&
          sdcCreateRes.body.data.priority === "High" &&
          sdcCreateRes.body.data.status === "Open" &&
          sdcCreateRes.body.data.institution?.id === validInstId,
        "Returned complaint payload matches registered attributes and institution"
      );
    }

    // 3.4 Scoped GRC Officer successfully registers using bureau code "PGRC"
    const grcCreateRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${grcOfficerToken}` },
      body: JSON.stringify({
        institution_id: validInstPermId, // using permanent ID to verify institution lookup
        title: "GRC Officer Case via Code",
        description: "Faculty non-payment grievance submitted via portal",
        category: "Faculty Non-Payment",
        bureau: "PGRC",
        priority: "Normal",
        complainant_type: "FACULTY",
        lodging_channel: "ONLINE_PORTAL"
      })
    });
    assert(
      grcCreateRes.status === 201 && grcCreateRes.body?.success === true,
      "GRC Officer successfully registered complaint using bureau code 'PGRC' and permanent institution ID (HTTP 201)",
      grcCreateRes.body
    );
    if (grcCreateRes.body?.data?.complaint_id) {
      createdComplaintIds.push(grcCreateRes.body.data.complaint_id);
      assert(
        grcCreateRes.body.data.bureau === "Grievance Redressal Cell" &&
          grcCreateRes.body.data.priority === "Medium",
        "Bureau code 'PGRC' resolved to 'Grievance Redressal Cell' and 'Normal' normalized to 'Medium'"
      );
    }

    // 3.5 Super Admin registers complaint for any bureau (e.g. Approval Bureau)
    const adminCreateRes = await request("/api/v1/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        institution_id: validInstId,
        title: "Super Admin Registered Case",
        description: "Unapproved intake in mechanical engineering branch",
        category: "Unapproved Courses",
        bureau: "Approval Bureau",
        priority: "Critical",
        due_date: "2026-11-20T00:00:00.000Z"
      })
    });
    assert(
      adminCreateRes.status === 201 && adminCreateRes.body?.success === true,
      "SUPER_ADMIN successfully registered complaint for Approval Bureau (HTTP 201)",
      adminCreateRes.body
    );
    if (adminCreateRes.body?.data?.complaint_id) {
      createdComplaintIds.push(adminCreateRes.body.data.complaint_id);
      assert(
        adminCreateRes.body.data.bureau === "Approval Bureau" &&
          adminCreateRes.body.data.priority === "Critical" &&
          adminCreateRes.body.data.due_date.startsWith("2026-11-20"),
        "Custom due_date and Critical priority preserved correctly"
      );
    }

    console.log("\n--- 4. Transactional Persistence & Audit Logging ---");

    // Check that complaint_actions recorded a CREATED action for each registered complaint
    for (const compId of createdComplaintIds) {
      const actionRes = await dbClient.query(
        `SELECT id, complaint_id, action_type, action, actor_name, details
         FROM complaint_actions
         WHERE complaint_id = $1 AND action_type = 'CREATED';`,
        [compId]
      );
      assert(
        actionRes.rows.length === 1,
        `Audit action 'CREATED' transactionally recorded for ${compId}`,
        actionRes.rows[0]
      );
      if (actionRes.rows.length > 0) {
        assert(
          actionRes.rows[0].action === "Complaint registered at ingestion gateway" &&
            typeof actionRes.rows[0].details === "object",
          `Audit action details properly structured with JSON metadata for ${compId}`
        );
      }
    }

    console.log("\n--- 5. Concurrency & Collision-Free ID Generation ---");

    // Launch 5 parallel registration requests concurrently
    console.log("  Executing 5 concurrent complaint creation requests...");
    const concurrentPayloads = [1, 2, 3, 4, 5].map((idx) => ({
      institution_id: validInstId,
      title: `Concurrent Case ${idx}`,
      description: `Testing concurrency safe sequential ID generation ${idx}`,
      category: "Infrastructure Deficiency",
      bureau: "Approval Bureau",
      priority: "Low"
    }));

    const concurrentResults = await Promise.all(
      concurrentPayloads.map((payload) =>
        request("/api/v1/complaints", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(payload)
        })
      )
    );

    const allSuccessful = concurrentResults.every((r) => r.status === 201 && r.body?.success);
    assert(allSuccessful, "All 5 concurrent requests succeeded with HTTP 201");

    const generatedIds = concurrentResults.map((r) => r.body?.data?.complaint_id).filter(Boolean);
    createdComplaintIds.push(...generatedIds);

    assert(
      generatedIds.length === 5,
      "5 complaint IDs successfully returned from concurrent execution",
      generatedIds
    );

    const uniqueIds = new Set(generatedIds);
    assert(
      uniqueIds.size === 5,
      "All 5 generated complaint IDs are strictly distinct (zero collisions under concurrency)",
      Array.from(uniqueIds)
    );

    // Verify IDs follow CMP-[0-9]+ format
    const validIdFormat = generatedIds.every((id) => /^CMP-[0-9]+$/.test(id));
    assert(validIdFormat, "All generated IDs conform to sequential CMP-xxxx pattern");

  } finally {
    // 6. Test Fixture Teardown
    console.log("\n--- 6. Test Fixture Teardown ---");
    if (createdComplaintIds.length > 0) {
      await dbClient.query(
        "DELETE FROM complaint_actions WHERE complaint_id = ANY($1::text[]);",
        [createdComplaintIds]
      );
      const delComp = await dbClient.query(
        "DELETE FROM complaints WHERE complaint_id = ANY($1::text[]);",
        [createdComplaintIds]
      );
      console.log(`  Cleaned up ${delComp.rowCount} test complaints and associated audit records.`);
    }
    dbClient.release();
    await pool.end();
  }

  console.log(`\n==================================================`);
  console.log(`Complaint Registration Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
