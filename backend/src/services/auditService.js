import { query } from "../config/db.js";
import { parsePagination, buildMeta } from "../utils/pagination.js";
import { BUREAU_CODE_MAP, VALID_BUREAUS } from "./complaintService.js";

/**
 * Lists audit log actions from complaint_actions joined with complaints and users.
 * Enforces database-level bureau authorization, pagination, and optional filters.
 *
 * @param {Object} rawQuery - Express req.query object
 * @param {Object} user - Authenticated user context
 * @returns {Promise<{ data: Array<Object>, meta: Object }>}
 */
export async function listAuditLogs(rawQuery = {}, user) {
  if (!user) {
    const error = new Error("Authentication required to access audit logs");
    error.code = "UNAUTHORIZED";
    error.statusCode = 401;
    throw error;
  }

  // Parse pagination with validation
  const pagination = parsePagination(rawQuery, 20, 100);
  if (pagination.error) {
    const error = new Error(pagination.error);
    error.code = "INVALID_INPUT";
    error.statusCode = 400;
    throw error;
  }

  const conditions = [];
  const params = [];

  // 1. Enforce Bureau-Level Authorization inside SQL query
  if (user.role === "SUPER_ADMIN" || user.role === "AUDITOR") {
    // Super Admin and Auditor have system-wide read access across all bureaus
  } else if (
    user.role === "BUREAU_HEAD" ||
    user.role === "BUREAU_OFFICER" ||
    user.role === "GRIEVANCE_OFFICER"
  ) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    params.push(user.bureau);
    const bureauIdx = params.length;
    // Permitted if complaint currently belongs to user's bureau, originated in it,
    // or user's bureau was a party in an inter-bureau transfer
    conditions.push(`(
      c.bureau = $${bureauIdx}
      OR c.originating_bureau = $${bureauIdx}
      OR EXISTS (
        SELECT 1 FROM complaint_transfers tr
        WHERE tr.complaint_id = c.complaint_id
          AND (tr.from_bureau = $${bureauIdx} OR tr.to_bureau = $${bureauIdx})
      )
    )`);
  } else {
    const error = new Error(`Role '${user.role}' is not authorized to access audit logs`);
    error.code = "FORBIDDEN_ROLE";
    error.statusCode = 403;
    throw error;
  }

  // 2. Optional Filters
  if (rawQuery.complaint_id) {
    const cleanComplaintId = String(rawQuery.complaint_id).trim();
    if (cleanComplaintId) {
      params.push(cleanComplaintId);
      conditions.push(`act.complaint_id = $${params.length}`);
    }
  }

  if (rawQuery.action_type) {
    const cleanActionType = String(rawQuery.action_type).trim().toUpperCase();
    if (cleanActionType) {
      params.push(cleanActionType);
      conditions.push(`act.action_type = $${params.length}`);
    }
  }

  if (rawQuery.bureau) {
    const rawBureau = String(rawQuery.bureau).trim();
    let resolvedBureau;
    const upperBureau = rawBureau.toUpperCase();
    if (BUREAU_CODE_MAP[upperBureau]) {
      resolvedBureau = BUREAU_CODE_MAP[upperBureau];
    } else {
      const matched = VALID_BUREAUS.find((b) => b.toLowerCase() === rawBureau.toLowerCase());
      resolvedBureau = matched || rawBureau;
    }

    params.push(resolvedBureau);
    const bIdx = params.length;
    conditions.push(`(c.bureau = $${bIdx} OR c.originating_bureau = $${bIdx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 3. Count total matching rows
  const countSql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM complaint_actions act
    JOIN complaints c ON act.complaint_id = c.complaint_id
    ${whereClause};
  `;
  const countRes = await query(countSql, params);
  const total = countRes.rows[0]?.total || 0;

  // 4. Query paginated logs with actor and complaint details
  const queryParams = [...params, pagination.limit, pagination.offset];
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const listSql = `
    SELECT
      act.id,
      act.complaint_id,
      act.action_type,
      act.action,
      act.notes,
      act.actor_id,
      act.actor_name,
      act.details,
      act.created_at,
      c.bureau AS complaint_bureau,
      c.originating_bureau,
      c.title AS complaint_title,
      c.status AS complaint_status,
      u.role AS actor_role,
      u.email AS actor_email
    FROM complaint_actions act
    JOIN complaints c ON act.complaint_id = c.complaint_id
    LEFT JOIN users u ON act.actor_id = u.id
    ${whereClause}
    ORDER BY act.created_at DESC, act.id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const listRes = await query(listSql, queryParams);

  const formattedLogs = listRes.rows.map((row) => ({
    id: String(row.id),
    complaint_id: row.complaint_id,
    action_type: row.action_type,
    action: row.action,
    notes: row.notes,
    actor: {
      id: row.actor_id,
      name: row.actor_name,
      role: row.actor_role || (row.details && row.details.role) || null,
      email: row.actor_email || null
    },
    details: row.details || {},
    bureau: row.complaint_bureau,
    originating_bureau: row.originating_bureau,
    complaint_title: row.complaint_title,
    complaint_status: row.complaint_status,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  }));

  const meta = buildMeta(total, pagination.page, pagination.limit);

  return { data: formattedLogs, meta };
}
