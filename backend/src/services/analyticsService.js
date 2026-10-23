import { query } from "../config/db.js";

/**
 * Safely format a timestamp or date value to an ISO 8601 string or null.
 *
 * @param {Date|string|null} val
 * @returns {string|null}
 */
function toIsoString(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : val.toISOString();
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Preserve date-only strings (YYYY-MM-DD) cleanly as UTC ISO strings without local timezone shifting
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T00:00:00.000Z`;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Normalizes live database complaint status for the analytics engine.
 * Specifically maps terminal statuses 'Resolved' and 'Closed' to 'disposed'
 * so the analytics engine correctly classifies them as closed cases
 * without mutating database records.
 *
 * @param {string} status
 * @returns {string}
 */
function normalizeStatusForAnalytics(status) {
  if (!status || typeof status !== "string") return "unknown";
  const trimmed = status.trim();
  if (trimmed === "Resolved" || trimmed === "Closed") {
    return "disposed";
  }
  return trimmed;
}

/**
 * Retrieves analytics cases from complaint_analytics_view enriched with
 * operational overlap flags from complaint_links and scoped to the user's bureau.
 *
 * @param {Object} user - Authenticated user context ({ id, email, role, bureau })
 * @returns {Promise<Array<Object>>} Array of case objects formatted for the analytics module
 */
export async function getCasesForUser(user) {
  if (!user) {
    const error = new Error("Authentication required: missing user context.");
    error.code = "UNAUTHORIZED";
    error.statusCode = 401;
    throw error;
  }

  const allowedRoles = ["SUPER_ADMIN", "AUDITOR", "BUREAU_HEAD", "BUREAU_OFFICER", "GRIEVANCE_OFFICER"];
  if (!allowedRoles.includes(user.role)) {
    const error = new Error(`Role '${user.role}' is not authorized to access analytics.`);
    error.code = "FORBIDDEN_ROLE";
    error.statusCode = 403;
    throw error;
  }

  const isBureauScoped =
    user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER";

  if (isBureauScoped && !user.bureau) {
    const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
    error.code = "FORBIDDEN_BUREAU_ACCESS";
    error.statusCode = 403;
    throw error;
  }

  const params = [];
  let whereClause = "";

  if (isBureauScoped) {
    params.push(user.bureau);
    whereClause = `WHERE v.bureau = $${params.length}`;
  }

  const sql = `
    SELECT
      v.complaint_id,
      v.institution_id,
      v.region,
      v.category,
      v.created_at,
      v.due_date,
      v.last_action_date,
      v.status,
      v.bureau,
      v.transfer_count,
      v.is_escalated,
      COALESCE(ol.has_overlap, FALSE) AS has_overlap
    FROM complaint_analytics_view v
    LEFT JOIN (
      SELECT DISTINCT link_complaint_id AS complaint_id, TRUE AS has_overlap
      FROM (
        SELECT complaint_id_a AS link_complaint_id
        FROM complaint_links
        WHERE review_status IN ('Suggested', 'Confirmed')
        UNION ALL
        SELECT complaint_id_b AS link_complaint_id
        FROM complaint_links
        WHERE review_status IN ('Suggested', 'Confirmed')
      ) active_links
    ) ol ON v.complaint_id = ol.complaint_id
    ${whereClause}
    ORDER BY v.created_at DESC;
  `;

  const result = await query(sql, params);

  return result.rows.map((row) => ({
    complaint_id: row.complaint_id,
    institution_id: row.institution_id,
    region: row.region,
    category: row.category,
    created_at: toIsoString(row.created_at),
    due_date: toIsoString(row.due_date),
    last_action_date: toIsoString(row.last_action_date),
    status: normalizeStatusForAnalytics(row.status),
    bureau: row.bureau,
    transfer_count: parseInt(row.transfer_count, 10) || 0,
    is_escalated: Boolean(row.is_escalated),
    has_overlap: Boolean(row.has_overlap)
  }));
}
