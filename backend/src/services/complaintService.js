import { query } from "../config/db.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
