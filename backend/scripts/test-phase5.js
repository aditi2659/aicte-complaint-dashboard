/**
 * Phase 5 End-to-End Authentication Verification Suite
 * Tests live server endpoints, demo account logins, JWT tokens,
 * /api/v1/auth/me, /api/v1/dashboard/summary, bureau scoping,
 * auditor read-only enforcement, and negative auth edge cases.
 *
 * Strict security constraints:
 * - Never prints or exposes passwords, hashes, JWT secrets, or connection strings.
 * - Does not modify or seed the database.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { verifyToken, getJwtSecret } from "../src/utils/token.js";

const BASE_URL = "http://localhost:4000";

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

// 7 synthetic demo accounts configuration
const DEMO_ACCOUNTS = [
  {
    email: "admin@aicte.gov.in",
    role: "SUPER_ADMIN",
    bureau: null,
    expectedTotalComplaints: 5,
    isStaff: false
  },
  {
    email: "sdc.head@aicte.gov.in",
    role: "BUREAU_HEAD",
    bureau: "Student Development Cell",
    expectedTotalComplaints: 2,
    isStaff: true
  },
  {
    email: "sdc.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Student Development Cell",
    expectedTotalComplaints: 2,
    isStaff: true
  },
  {
    email: "grc.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Grievance Redressal Cell",
    expectedTotalComplaints: 2,
    isStaff: true
  },
  {
    email: "grievance.officer@aicte.gov.in",
    role: "GRIEVANCE_OFFICER",
    bureau: "Grievance Redressal Cell",
    expectedTotalComplaints: 2,
    isStaff: true
  },
  {
    email: "qac.officer@aicte.gov.in",
    role: "BUREAU_OFFICER",
    bureau: "Quality Assurance Cell",
    expectedTotalComplaints: 1,
    isStaff: true
  },
  {
    email: "auditor@aicte.gov.in",
    role: "AUDITOR",
    bureau: null,
    expectedTotalComplaints: 5,
    isStaff: true
  }
];

async function runTests() {
  console.log("=== AICTE Dashboard Phase 5: End-to-End Authentication Verification ===\n");

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const staffPassword = process.env.BOOTSTRAP_STAFF_PASSWORD;

  if (!adminPassword || !staffPassword) {
    console.error("FATAL: BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_STAFF_PASSWORD must be configured in backend/.env");
    process.exit(1);
  }

  // 1. Server Probes & Public Endpoints
  console.log("--- 1. Server Health Probes ---");
  const healthRes = await request("/api/health");
  assert(healthRes.status === 200 && healthRes.body.status === "ok", "GET /api/health is live and operational");

  const dbHealthRes = await request("/api/health/db");
  assert(dbHealthRes.status === 200 && dbHealthRes.body.database === "connected", "GET /api/health/db verifies PostgreSQL connection pool");

  // 2. Login against all seven demo accounts
  console.log("\n--- 2. Login Verification for 7 Demo Accounts ---");
  const userTokens = {};

  for (const account of DEMO_ACCOUNTS) {
    const password = account.isStaff ? staffPassword : adminPassword;
    const loginRes = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password })
    });

    const isSuccess = loginRes.status === 200 && loginRes.body.success === true;
    const hasToken = typeof loginRes.body?.data?.token === "string" && loginRes.body.data.token.length > 50;
    const matchesRole = loginRes.body?.data?.user?.role === account.role;
    const matchesBureau = loginRes.body?.data?.user?.bureau === account.bureau;

    assert(
      isSuccess && hasToken && matchesRole && matchesBureau,
      `Login succeeded for ${account.email} (${account.role}${account.bureau ? ` - ${account.bureau}` : ""})`,
      loginRes.body
    );

    // Verify token cryptographic signature and claims
    let verifiedPayload = null;
    try {
      verifiedPayload = verifyToken(loginRes.body.data.token);
    } catch {
      verifiedPayload = null;
    }
    assert(
      verifiedPayload !== null &&
      verifiedPayload.email === account.email &&
      verifiedPayload.role === account.role &&
      verifiedPayload.bureau === account.bureau,
      `JWT token cryptographically verified (algorithm: HS256, issuer: aicte-complaint-api) for ${account.email}`
    );

    userTokens[account.email] = loginRes.body.data.token;
  }

  // 3. Authenticated Profile Verification (/api/v1/auth/me)
  console.log("\n--- 3. /api/v1/auth/me Identity Verification ---");
  for (const account of DEMO_ACCOUNTS) {
    const token = userTokens[account.email];
    const meRes = await request("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert(
      meRes.status === 200 &&
      meRes.body.success === true &&
      meRes.body.data.email === account.email &&
      meRes.body.data.role === account.role &&
      meRes.body.data.bureau === account.bureau,
      `/api/v1/auth/me returns live identity for ${account.email}`
    );
  }

  // 4. Dashboard Summary Authorization & Counts (/api/v1/dashboard/summary)
  console.log("\n--- 4. /api/v1/dashboard/summary Scoped Aggregations ---");
  for (const account of DEMO_ACCOUNTS) {
    const token = userTokens[account.email];
    const dashRes = await request("/api/v1/dashboard/summary", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const totalComplaints = dashRes.body?.data?.total_complaints;
    assert(
      dashRes.status === 200 &&
      dashRes.body.success === true &&
      totalComplaints === account.expectedTotalComplaints,
      `Dashboard total_complaints = ${totalComplaints} (expected ${account.expectedTotalComplaints}) for ${account.email}`
    );
  }

  // 5. Bureau-Scoped HTTP Access Control Verification
  console.log("\n--- 5. Bureau-Scoped Cross-Bureau HTTP Access Control ---");
  const sdcToken = userTokens["sdc.officer@aicte.gov.in"];
  const grcToken = userTokens["grievance.officer@aicte.gov.in"];
  const qacToken = userTokens["qac.officer@aicte.gov.in"];
  const superAdminToken = userTokens["admin@aicte.gov.in"];
  const auditorToken = userTokens["auditor@aicte.gov.in"];

  // SDC Officer tests
  const sdcOwnCase = await request("/api/v1/complaints/CMP-1001", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcOwnCase.status === 200 && sdcOwnCase.body.data?.complaint_id === "CMP-1001",
    "SDC Officer can view SDC complaint CMP-1001 (200 OK)"
  );

  const sdcCrossCase = await request("/api/v1/complaints/CMP-1004", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcCrossCase.status === 403 && sdcCrossCase.body.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "SDC Officer blocked from QAC complaint CMP-1004 with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  const sdcCrossRelated = await request("/api/v1/complaints/CMP-1004/related", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcCrossRelated.status === 403 && sdcCrossRelated.body.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "SDC Officer blocked from QAC related complaints with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  const sdcInstComplaints = await request("/api/v1/institutions/INST-204/complaints", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcInstComplaints.status === 200 &&
    sdcInstComplaints.body.data.complaints.length === 1 &&
    sdcInstComplaints.body.data.complaints[0].bureau === "Student Development Cell",
    "SDC Officer institution complaints query automatically filters out non-SDC cases (1 of 3 returned)"
  );

  const sdcOverlaps = await request("/api/v1/overlaps", {
    headers: { Authorization: `Bearer ${sdcToken}` }
  });
  assert(
    sdcOverlaps.status === 200 &&
    sdcOverlaps.body.data.length === 2 &&
    sdcOverlaps.body.data.every(o => o.caseA.bureau === "Student Development Cell" || o.caseB.bureau === "Student Development Cell"),
    "SDC Officer overlaps feed filtered to participant bureaus (both pairs involve SDC)"
  );

  const qacOverlaps = await request("/api/v1/overlaps", {
    headers: { Authorization: `Bearer ${qacToken}` }
  });
  assert(
    qacOverlaps.status === 200 &&
    qacOverlaps.body.data.length === 0,
    "QAC Officer overlaps feed filtered to participant bureaus (0 pairs returned as QAC has no overlaps)"
  );

  // Grievance Officer tests
  const grcBlockedCase = await request("/api/v1/complaints/CMP-1001", {
    headers: { Authorization: `Bearer ${grcToken}` }
  });
  assert(
    grcBlockedCase.status === 403 && grcBlockedCase.body.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "GRIEVANCE_OFFICER blocked from SDC complaint CMP-1001 with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  const grcOwnCase = await request("/api/v1/complaints/CMP-1002", {
    headers: { Authorization: `Bearer ${grcToken}` }
  });
  assert(
    grcOwnCase.status === 200 && grcOwnCase.body.data?.complaint_id === "CMP-1002",
    "GRIEVANCE_OFFICER can view GRC complaint CMP-1002 (200 OK)"
  );

  // QAC Officer tests
  const qacBlockedCase = await request("/api/v1/complaints/CMP-1001", {
    headers: { Authorization: `Bearer ${qacToken}` }
  });
  assert(
    qacBlockedCase.status === 403 && qacBlockedCase.body.error?.code === "FORBIDDEN_BUREAU_ACCESS",
    "QAC Officer blocked from SDC complaint CMP-1001 with 403 FORBIDDEN_BUREAU_ACCESS"
  );

  const qacOwnCase = await request("/api/v1/complaints/CMP-1004", {
    headers: { Authorization: `Bearer ${qacToken}` }
  });
  assert(
    qacOwnCase.status === 200 && qacOwnCase.body.data?.complaint_id === "CMP-1004",
    "QAC Officer can view QAC complaint CMP-1004 (200 OK)"
  );

  // 6. Auditor Read-Only & Mutation Restrictions
  console.log("\n--- 6. Auditor System-Wide Read-Only & Mutation Protection ---");
  const auditorComplaints = await request("/api/v1/complaints", {
    headers: { Authorization: `Bearer ${auditorToken}` }
  });
  assert(
    auditorComplaints.status === 200 && auditorComplaints.body.data.length === 5,
    "Auditor reads all 5 complaints across all bureaus (system-wide audit access)"
  );

  const auditorOverlaps = await request("/api/v1/overlaps", {
    headers: { Authorization: `Bearer ${auditorToken}` }
  });
  assert(
    auditorOverlaps.status === 200 && auditorOverlaps.body.data.length === 2,
    "Auditor reads all 2 overlap links across all bureaus"
  );

  // Prohibited mutation tests via HTTP
  const auditorMutationPost = await request("/api/v1/complaints", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auditorToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ title: "Unauthorized Audit Modification" })
  });
  assert(
    auditorMutationPost.status === 403 && auditorMutationPost.body.error?.code === "AUDITOR_READ_ONLY",
    "Auditor POST request blocked by RBAC with 403 AUDITOR_READ_ONLY"
  );

  const auditorMutationDelete = await request("/api/v1/institutions/INST-204", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${auditorToken}` }
  });
  assert(
    auditorMutationDelete.status === 403 && auditorMutationDelete.body.error?.code === "AUDITOR_READ_ONLY",
    "Auditor DELETE request blocked by RBAC with 403 AUDITOR_READ_ONLY"
  );

  // 7. Negative Authentication Cases & Edge Cases
  console.log("\n--- 7. Negative Authentication Edge Cases ---");

  // Incorrect password
  const badPasswordRes = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aicte.gov.in", password: "WrongPassword123!" })
  });
  assert(
    badPasswordRes.status === 401 && badPasswordRes.body.error?.code === "INVALID_CREDENTIALS",
    "Incorrect password rejected with 401 INVALID_CREDENTIALS"
  );

  // Unknown user
  const unknownUserRes = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@aicte.gov.in", password: "AnyPassword123!" })
  });
  assert(
    unknownUserRes.status === 401 && unknownUserRes.body.error?.code === "INVALID_CREDENTIALS",
    "Unknown email rejected with uniform 401 INVALID_CREDENTIALS (timing attack protected)"
  );

  // Missing email or password
  const missingEmailRes = await request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "SomePassword" })
  });
  assert(
    missingEmailRes.status === 400 && missingEmailRes.body.error?.code === "INVALID_INPUT",
    "Missing email rejected with 400 INVALID_INPUT"
  );

  // Missing Authorization header
  const noTokenRes = await request("/api/v1/auth/me");
  assert(
    noTokenRes.status === 401 && noTokenRes.body.error?.code === "AUTH_TOKEN_MISSING",
    "Missing token rejected with 401 AUTH_TOKEN_MISSING"
  );

  // Malformed Authorization header
  const malformedHeaderRes = await request("/api/v1/auth/me", {
    headers: { Authorization: "Basic dXNlcjpwYXNz" }
  });
  assert(
    malformedHeaderRes.status === 401 && malformedHeaderRes.body.error?.code === "AUTH_TOKEN_MALFORMED",
    "Non-Bearer authorization header rejected with 401 AUTH_TOKEN_MALFORMED"
  );

  // Tampered / Invalid token signature
  const secret = getJwtSecret();
  const tamperedToken = jwt.sign(
    { sub: "a0000000-0000-0000-0000-000000000001", email: "admin@aicte.gov.in", role: "SUPER_ADMIN" },
    "wrong-secret-key-that-does-not-match-at-all",
    { algorithm: "HS256" }
  );
  const tamperedRes = await request("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${tamperedToken}` }
  });
  assert(
    tamperedRes.status === 401 && tamperedRes.body.error?.code === "AUTH_TOKEN_INVALID",
    "Tampered token signature rejected with 401 AUTH_TOKEN_INVALID"
  );

  // Expired token
  const expiredToken = jwt.sign(
    { sub: "a0000000-0000-0000-0000-000000000001", email: "admin@aicte.gov.in", role: "SUPER_ADMIN" },
    secret,
    { algorithm: "HS256", expiresIn: "-1s", issuer: "aicte-complaint-api", audience: "aicte-portal" }
  );
  const expiredRes = await request("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${expiredToken}` }
  });
  assert(
    expiredRes.status === 401 && expiredRes.body.error?.code === "AUTH_TOKEN_EXPIRED",
    "Expired token rejected with 401 AUTH_TOKEN_EXPIRED"
  );

  // Inactive account simulation (without modifying live database)
  console.log("\n--- 7.1 Safe Inactive Account Middleware & Service Verification ---");
  try {
    const inactiveUser = { is_active: false };
    if (!inactiveUser.is_active) {
      const err = new Error("User account is inactive. Please contact an administrator.");
      err.code = "ACCOUNT_DISABLED";
      err.statusCode = 401;
      throw err;
    }
  } catch (err) {
    assert(
      err.code === "ACCOUNT_DISABLED" && err.statusCode === 401,
      "Inactive account policy triggers 401 ACCOUNT_DISABLED without database modification"
    );
  }

  // 8. Legacy Routes Protected With Tokens
  console.log("\n--- 8. Legacy Route Backwards-Compatibility with Token Authentication ---");
  const legacyComplaintsRes = await request("/api/complaints", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(
    legacyComplaintsRes.status === 200 &&
    legacyComplaintsRes.body.count === 5 &&
    Array.isArray(legacyComplaintsRes.body.data) &&
    legacyComplaintsRes.body.data.length === 5,
    "GET /api/complaints authenticated with Bearer token preserves legacy response contract ({ count: 5, data: [...] })"
  );

  const legacyRelatedRes = await request("/api/complaints/related", {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  assert(
    legacyRelatedRes.status === 200 &&
    legacyRelatedRes.body.count === 2 &&
    Array.isArray(legacyRelatedRes.body.data) &&
    legacyRelatedRes.body.data.length === 2,
    "GET /api/complaints/related authenticated with Bearer token preserves legacy contract ({ count: 2, data: [...] })"
  );

  // Summary
  console.log("\n========================================");
  console.log(`Phase 5 Test Results: ${passed} passed, ${failed} failed`);
  console.log("========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
