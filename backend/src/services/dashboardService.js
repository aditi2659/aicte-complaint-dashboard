import { query } from "../config/db.js";

/**
 * Returns aggregated dashboard metrics calculated from live database state,
 * with database-enforced bureau scoping for bureau officers and heads.
 */
export async function getDashboardSummary(user = null) {
  const isBureauScoped = Boolean(
    user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")
  );

  if (isBureauScoped && !user.bureau) {
    const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
    error.code = "FORBIDDEN_BUREAU_ACCESS";
    error.statusCode = 403;
    throw error;
  }

  const bureauParam = isBureauScoped ? [user.bureau] : [];
  const complaintWhere = isBureauScoped ? "WHERE (c.bureau = $1 OR c.originating_bureau = $1)" : "";
  const overlapWhere = isBureauScoped
    ? "JOIN complaints ca ON cl.complaint_id_a = ca.complaint_id JOIN complaints cb ON cl.complaint_id_b = cb.complaint_id WHERE (ca.bureau = $1 OR cb.bureau = $1)"
    : "";

  const [summaryRes, statusRes, bureauRes, priorityRes, overlapsRes] = await Promise.all([
    query(
      `SELECT
        COUNT(*)::INTEGER AS total_complaints,
        COUNT(*) FILTER (WHERE c.is_escalated = TRUE)::INTEGER AS escalated_complaints
      FROM complaints c
      ${complaintWhere};`,
      bureauParam
    ),
    query(
      `SELECT c.status, COUNT(*)::INTEGER AS count
      FROM complaints c
      ${complaintWhere}
      GROUP BY c.status
      ORDER BY count DESC, c.status ASC;`,
      bureauParam
    ),
    query(
      `SELECT c.bureau, COUNT(*)::INTEGER AS count
      FROM complaints c
      ${complaintWhere}
      GROUP BY c.bureau
      ORDER BY count DESC, c.bureau ASC;`,
      bureauParam
    ),
    query(
      `SELECT c.priority, COUNT(*)::INTEGER AS count
      FROM complaints c
      ${complaintWhere}
      GROUP BY c.priority
      ORDER BY count DESC, c.priority ASC;`,
      bureauParam
    ),
    query(
      `SELECT
        COUNT(*)::INTEGER AS total_overlaps,
        COUNT(*) FILTER (WHERE cl.review_status = 'Suggested')::INTEGER AS suggested_overlaps,
        COUNT(*) FILTER (WHERE cl.review_status = 'Confirmed')::INTEGER AS confirmed_overlaps,
        COUNT(*) FILTER (WHERE cl.review_status = 'Dismissed')::INTEGER AS dismissed_overlaps
      FROM complaint_links cl
      ${overlapWhere};`,
      bureauParam
    )
  ]);

  const summary = summaryRes.rows[0] || { total_complaints: 0, escalated_complaints: 0 };
  const overlaps = overlapsRes.rows[0] || {
    total_overlaps: 0,
    suggested_overlaps: 0,
    confirmed_overlaps: 0,
    dismissed_overlaps: 0
  };

  const byStatus = {};
  for (const row of statusRes.rows) {
    byStatus[row.status] = row.count;
  }

  const byBureau = {};
  for (const row of bureauRes.rows) {
    byBureau[row.bureau] = row.count;
  }

  const byPriority = {};
  for (const row of priorityRes.rows) {
    byPriority[row.priority] = row.count;
  }

  return {
    total_complaints: summary.total_complaints,
    escalated_complaints: summary.escalated_complaints,
    by_status: byStatus,
    by_bureau: byBureau,
    by_priority: byPriority,
    overlaps: {
      total: overlaps.total_overlaps,
      suggested: overlaps.suggested_overlaps,
      confirmed: overlaps.confirmed_overlaps,
      dismissed: overlaps.dismissed_overlaps
    }
  };
}
