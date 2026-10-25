import { query, getPool } from "../config/db.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const VALID_BUREAUS = [
  "Student Development Cell",
  "Grievance Redressal Cell",
  "Quality Assurance Cell",
  "Approval Bureau",
  "Policy & Academic Planning Bureau",
  "Faculty Development Bureau"
];

export const BUREAU_CODE_MAP = {
  SDC: "Student Development Cell",
  PGRC: "Grievance Redressal Cell",
  RB: "Quality Assurance Cell",
  AB: "Approval Bureau",
  PAPB: "Policy & Academic Planning Bureau",
  FDB: "Faculty Development Bureau"
};

/**
 * List complaints with filtering, search, bounded pagination, and database-level bureau scoping.
 */
export async function listComplaints(filters = {}, pagination = { limit: 20, offset: 0 }, user = null) {
  const conditions = [];
  const params = [];

  // 1. Enforce Bureau-Level Authorization inside SQL query
  if (user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    params.push(user.bureau);
    conditions.push(`(c.bureau = $${params.length} OR c.originating_bureau = $${params.length})`);
  } else if (filters.bureau) {
    params.push(filters.bureau);
    conditions.push(`c.bureau = $${params.length}`);
  }

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (filters.priority) {
    params.push(filters.priority);
    conditions.push(`c.priority = $${params.length}`);
  }

  if (filters.institution_id) {
    params.push(filters.institution_id);
    const idx = params.length;
    if (UUID_REGEX.test(filters.institution_id)) {
      conditions.push(`c.institution_id = $${idx}`);
    } else {
      conditions.push(`(c.institution_id::text = $${idx} OR i.aicte_permanent_id = $${idx})`);
    }
  }

  if (filters.is_escalated !== undefined) {
    params.push(filters.is_escalated === true || filters.is_escalated === "true");
    conditions.push(`c.is_escalated = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const idx = params.length;
    conditions.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx} OR c.complaint_id ILIKE $${idx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM complaints c
    JOIN institutions i ON c.institution_id = i.id
    ${whereClause};
  `;
  const countResult = await query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  const queryParams = [...params, pagination.limit, pagination.offset];
  const listSql = `
    SELECT
      c.complaint_id,
      c.complaint_id AS id,
      c.title,
      c.category,
      c.description,
      c.bureau,
      c.originating_bureau,
      c.priority,
      c.status,
      c.due_date,
      c.is_escalated,
      c.created_at,
      c.updated_at,
      c.created_by,
      i.id AS institution_id,
      i.aicte_permanent_id,
      i.aicte_permanent_id AS institution_permanent_id,
      i.institution_name,
      i.state AS institution_state,
      COALESCE(o.has_overlap, false) AS has_overlap,
      COALESCE(o.matched_case_ids, ARRAY[]::TEXT[]) AS matched_case_ids
    FROM complaints c
    JOIN institutions i ON c.institution_id = i.id
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
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const listResult = await query(listSql, queryParams);
  const complaints = listResult.rows.map((row) => ({
    ...row,
    has_overlap: Boolean(row.has_overlap),
    matched_case_ids: Array.isArray(row.matched_case_ids) ? row.matched_case_ids : []
  }));
  return { complaints, total };
}

/**
 * Get complete complaint details by ID, enforcing bureau access control.
 */
export async function getComplaintById(complaintId, user = null) {
  const complaintSql = `
    SELECT
      c.complaint_id,
      c.title,
      c.category,
      c.description,
      c.bureau,
      c.originating_bureau,
      c.priority,
      c.status,
      c.due_date,
      c.is_escalated,
      c.created_at,
      c.updated_at,
      c.created_by,
      i.id AS institution_id,
      i.aicte_permanent_id AS institution_permanent_id,
      i.institution_name,
      i.institution_type,
      i.state AS institution_state,
      i.approval_status AS institution_approval_status,
      u.id AS assigned_user_id,
      u.full_name AS assigned_user_name,
      u.email AS assigned_user_email,
      u.role AS assigned_user_role,
      u.bureau AS assigned_user_bureau,
      COALESCE(o.has_overlap, false) AS has_overlap,
      COALESCE(o.matched_case_ids, ARRAY[]::TEXT[]) AS matched_case_ids
    FROM complaints c
    JOIN institutions i ON c.institution_id = i.id
    LEFT JOIN users u ON c.assigned_to = u.id
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
    WHERE c.complaint_id = $1;
  `;

  const complaintResult = await query(complaintSql, [complaintId]);
  if (complaintResult.rows.length === 0) {
    return null;
  }

  const row = complaintResult.rows[0];

  // Fetch transfers history
  const transfersSql = `
    SELECT
      id,
      from_bureau,
      to_bureau,
      reason,
      status,
      notes,
      created_at,
      reviewed_at
    FROM complaint_transfers
    WHERE complaint_id = $1
    ORDER BY created_at ASC;
  `;
  const transfersResult = await query(transfersSql, [complaintId]);

  // Bureau Access Check for scoped roles
  if (user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    const isOwner = row.bureau === user.bureau || row.originating_bureau === user.bureau;
    const isTransferred = transfersResult.rows.some(
      (t) => t.from_bureau === user.bureau || t.to_bureau === user.bureau
    );

    if (!isOwner && !isTransferred) {
      const error = new Error(`Access forbidden: Complaint '${complaintId}' belongs to another bureau.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
  }

  // Fetch actions history
  const actionsSql = `
    SELECT
      id,
      action_type,
      action,
      notes,
      actor_name,
      details,
      created_at
    FROM complaint_actions
    WHERE complaint_id = $1
    ORDER BY created_at ASC;
  `;
  const actionsResult = await query(actionsSql, [complaintId]);

  return {
    id: row.complaint_id,
    complaint_id: row.complaint_id,
    title: row.title,
    category: row.category,
    description: row.description,
    bureau: row.bureau,
    originating_bureau: row.originating_bureau,
    priority: row.priority,
    status: row.status,
    due_date: row.due_date,
    is_escalated: row.is_escalated,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    has_overlap: Boolean(row.has_overlap),
    matched_case_ids: Array.isArray(row.matched_case_ids) ? row.matched_case_ids : [],
    institution: {
      id: row.institution_id,
      aicte_permanent_id: row.institution_permanent_id,
      name: row.institution_name,
      type: row.institution_type,
      state: row.institution_state,
      approval_status: row.institution_approval_status
    },
    assigned_to: row.assigned_user_id ? {
      id: row.assigned_user_id,
      name: row.assigned_user_name,
      email: row.assigned_user_email,
      role: row.assigned_user_role,
      bureau: row.assigned_user_bureau
    } : null,
    actions: actionsResult.rows,
    transfers: transfersResult.rows
  };
}

/**
 * Returns complaints in the legacy format expected by existing consumers.
 * Queries live PostgreSQL and enforces user bureau scoping.
 */
export async function getLegacyComplaints(user = null) {
  const conditions = [];
  const params = [];

  if (user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    params.push(user.bureau);
    conditions.push(`(c.bureau = $1 OR c.originating_bureau = $1)`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      c.complaint_id AS id,
      COALESCE(i.aicte_permanent_id, i.id::text) AS "institutionId",
      i.institution_name AS "institutionName",
      c.bureau,
      c.category,
      c.description,
      to_char(c.created_at, 'YYYY-MM-DD') AS "createdAt",
      c.status
    FROM complaints c
    JOIN institutions i ON c.institution_id = i.id
    ${whereClause}
    ORDER BY c.created_at ASC;
  `;

  const result = await query(sql, params);
  return {
    count: result.rows.length,
    data: result.rows
  };
}

/**
 * Extension point for triggering post-creation workflows (e.g., cross-bureau overlap matching).
 * Preserves clean extension point without implementing automatic matching yet.
 */
export async function triggerPostCreationHook(complaint) {
  // Extension point: Aditi's complaint-matching pipeline hook will be invoked here.
  return Promise.resolve();
}

/**
 * Creates and persists a new complaint transactionally with concurrency-safe advisory locking
 * and records its CREATED audit action in complaint_actions.
 *
 * @param {Object} payload - Complaint registration payload
 * @param {Object} user - Authenticated user initiating registration
 * @returns {Promise<Object>} Full created complaint record
 */
export async function createComplaint(payload = {}, user) {
  if (!user) {
    const error = new Error("Authentication required to register complaints");
    error.code = "UNAUTHORIZED";
    error.statusCode = 401;
    throw error;
  }

  if (user.role === "AUDITOR") {
    const error = new Error("Auditors have read-only access and cannot create or modify records");
    error.code = "AUDITOR_READ_ONLY";
    error.statusCode = 403;
    throw error;
  }

  // 1. Validate payload inputs
  const rawInstitutionId = payload.institution_id || payload.institutionId;
  if (!rawInstitutionId || typeof rawInstitutionId !== "string" || !rawInstitutionId.trim()) {
    const error = new Error("Institution ID is required");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const title = (payload.title || payload.subject || "").trim();
  if (!title) {
    const error = new Error("Complaint title/subject is required");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const description = (payload.description || "").trim();
  if (!description) {
    const error = new Error("Complaint description is required");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const category = (payload.category || payload.category_label || payload.categoryLabel || "").trim();
  if (!category) {
    const error = new Error("Complaint category is required");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const rawBureau = (payload.bureau || payload.current_bureau || payload.currentBureau || "").trim();
  if (!rawBureau) {
    const error = new Error("Bureau is required");
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  // Normalize bureau
  const bureauUpper = rawBureau.toUpperCase();
  const targetBureau = BUREAU_CODE_MAP[bureauUpper] || VALID_BUREAUS.find((b) => b.toLowerCase() === rawBureau.toLowerCase());
  if (!targetBureau) {
    const error = new Error(`Bureau '${rawBureau}' is not a recognized AICTE bureau`);
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  // Normalize priority
  let priority = "Medium";
  if (payload.priority !== undefined && payload.priority !== null) {
    const p = String(payload.priority).trim().toLowerCase();
    if (p === "low") {
      priority = "Low";
    } else if (p === "medium" || p === "normal") {
      priority = "Medium";
    } else if (p === "high") {
      priority = "High";
    } else if (p === "critical" || p === "urgent") {
      priority = "Critical";
    } else {
      const error = new Error("Priority must be one of: Low, Medium, High, Critical");
      error.code = "INVALID_INPUT";
      error.statusCode = 400;
      throw error;
    }
  }

  // Compute or validate due_date
  let dueDate;
  if (payload.due_date) {
    const parsed = new Date(payload.due_date);
    if (Number.isNaN(parsed.getTime())) {
      const error = new Error("Invalid 'due_date' timestamp provided");
      error.code = "INVALID_INPUT";
      error.statusCode = 400;
      throw error;
    }
    dueDate = parsed.toISOString();
  } else {
    const slaDays = {
      Critical: 7,
      High: 15,
      Medium: 30,
      Low: 45
    }[priority] || 30;
    dueDate = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000).toISOString();
  }

  // 2. Validate Institution Existence
  const instCheckSql = `
    SELECT id, aicte_permanent_id, institution_name, institution_type, state, approval_status
    FROM institutions
    WHERE id::text = $1 OR aicte_permanent_id = $1;
  `;
  const instResult = await query(instCheckSql, [rawInstitutionId.trim()]);
  if (instResult.rows.length === 0) {
    const error = new Error(`Institution '${rawInstitutionId}' was not found`);
    error.code = "INSTITUTION_NOT_FOUND";
    error.statusCode = 404;
    throw error;
  }
  const institution = instResult.rows[0];

  // 3. Enforce Bureau-Level Authorization
  if (user.role === "SUPER_ADMIN") {
    // Permitted for all bureaus
  } else if (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER") {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    if (targetBureau !== user.bureau) {
      const error = new Error(
        `Bureau staff (${user.role}) may only register complaints within their assigned bureau (${user.bureau}). Attempted: '${targetBureau}'.`
      );
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error(`Role '${user.role}' is not authorized to register complaints`);
    error.code = "FORBIDDEN_ROLE";
    error.statusCode = 403;
    throw error;
  }

  // 4. Concurrency-Safe Transactional Persistence
  const activePool = getPool();
  if (!activePool) {
    throw new Error("Database pool is not configured.");
  }
  const client = await activePool.connect();

  let createdComplaint;
  try {
    await client.query("BEGIN;");

    // Acquire PostgreSQL transactional advisory lock to serialize sequential ID generation
    await client.query("SELECT pg_advisory_xact_lock(hashtext('aicte_complaint_id_sequence'));");

    const maxIdSql = `
      SELECT COALESCE(MAX(SUBSTRING(complaint_id FROM 5)::INTEGER), 1000) AS max_num
      FROM complaints
      WHERE complaint_id ~ '^CMP-[0-9]+$';
    `;
    const lockRes = await client.query(maxIdSql);
    const nextNum = Number(lockRes.rows[0].max_num) + 1;
    const newComplaintId = `CMP-${nextNum}`;

    const creatorName = user.full_name || user.email || "System User";
    const creatorId = UUID_REGEX.test(user.id) ? user.id : null;

    const insertComplaintSql = `
      INSERT INTO complaints (
        complaint_id,
        institution_id,
        title,
        category,
        description,
        bureau,
        originating_bureau,
        priority,
        status,
        due_date,
        is_escalated,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Open', $9, false, $10)
      RETURNING *;
    `;

    const complaintRes = await client.query(insertComplaintSql, [
      newComplaintId,
      institution.id,
      title,
      category,
      description,
      targetBureau,
      targetBureau,
      priority,
      dueDate,
      creatorName
    ]);

    const row = complaintRes.rows[0];

    // Record CREATED audit action in complaint_actions
    const actionDetails = JSON.stringify({
      category,
      priority,
      bureau: targetBureau,
      institution_id: institution.id,
      institution_name: institution.institution_name,
      complainant_type: payload.complainant_type || payload.complainantType || null,
      lodging_channel: payload.lodging_channel || payload.lodgingChannel || null
    });

    const insertActionSql = `
      INSERT INTO complaint_actions (
        complaint_id,
        action_type,
        action,
        notes,
        actor_id,
        actor_name,
        details
      ) VALUES ($1, 'CREATED', $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    const actionRes = await client.query(insertActionSql, [
      newComplaintId,
      "Complaint registered at ingestion gateway",
      title,
      creatorId,
      creatorName,
      actionDetails
    ]);

    await client.query("COMMIT;");

    createdComplaint = {
      id: row.complaint_id,
      complaint_id: row.complaint_id,
      title: row.title,
      category: row.category,
      description: row.description,
      bureau: row.bureau,
      originating_bureau: row.originating_bureau,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      is_escalated: row.is_escalated,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      has_overlap: false,
      matched_case_ids: [],
      institution: {
        id: institution.id,
        aicte_permanent_id: institution.aicte_permanent_id,
        name: institution.institution_name,
        type: institution.institution_type,
        state: institution.state,
        approval_status: institution.approval_status
      },
      assigned_to: null,
      actions: actionRes.rows,
      transfers: []
    };
  } catch (txError) {
    await client.query("ROLLBACK;");
    throw txError;
  } finally {
    client.release();
  }

  // 5. Clean extension point for future automated matching trigger
  triggerPostCreationHook(createdComplaint).catch((err) => {
    console.error(`[ComplaintCreation] Post-creation hook failed for ${createdComplaint.complaint_id}:`, err.message);
  });

  return createdComplaint;
}
