import { query } from "../config/db.js";

/**
 * List overlap suggestions with database-enforced bureau scoping.
 */
export async function listOverlaps(filters = {}, pagination = { limit: 20, offset: 0 }, user = null) {
  const conditions = [];
  const params = [];

  // Enforce bureau scoping for bureau heads and officers
  if (user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    params.push(user.bureau);
    conditions.push(`(ca.bureau = $${params.length} OR cb.bureau = $${params.length})`);
  }

  if (filters.review_status) {
    params.push(filters.review_status);
    conditions.push(`cl.review_status = $${params.length}`);
  }

  if (filters.min_score !== undefined) {
    const minScoreNum = Number(filters.min_score);
    if (!Number.isNaN(minScoreNum)) {
      params.push(minScoreNum);
      conditions.push(`cl.similarity_score >= $${params.length}`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*)::INTEGER AS total
    FROM complaint_links cl
    JOIN complaints ca ON cl.complaint_id_a = ca.complaint_id
    JOIN complaints cb ON cl.complaint_id_b = cb.complaint_id
    ${whereClause};
  `;
  const countResult = await query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  const queryParams = [...params, pagination.limit, pagination.offset];
  const listSql = `
    SELECT
      cl.id AS link_id,
      cl.complaint_id_a,
      cl.complaint_id_b,
      cl.similarity_score,
      cl.match_reasons,
      cl.review_status,
      cl.reviewed_at,
      cl.review_notes,
      cl.created_at,
      ca.title AS case_a_title,
      ca.category AS case_a_category,
      ca.bureau AS case_a_bureau,
      ca.status AS case_a_status,
      ca.priority AS case_a_priority,
      ca.description AS case_a_description,
      ia.id AS case_a_institution_id,
      ia.aicte_permanent_id AS case_a_institution_perm_id,
      ia.institution_name AS case_a_institution_name,
      cb.title AS case_b_title,
      cb.category AS case_b_category,
      cb.bureau AS case_b_bureau,
      cb.status AS case_b_status,
      cb.priority AS case_b_priority,
      cb.description AS case_b_description,
      ib.id AS case_b_institution_id,
      ib.aicte_permanent_id AS case_b_institution_perm_id,
      ib.institution_name AS case_b_institution_name
    FROM complaint_links cl
    JOIN complaints ca ON cl.complaint_id_a = ca.complaint_id
    JOIN institutions ia ON ca.institution_id = ia.id
    JOIN complaints cb ON cl.complaint_id_b = cb.complaint_id
    JOIN institutions ib ON cb.institution_id = ib.id
    ${whereClause}
    ORDER BY cl.similarity_score DESC, cl.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const listResult = await query(listSql, queryParams);

  const overlaps = listResult.rows.map((row) => ({
    id: row.link_id,
    similarity_score: Number(row.similarity_score),
    match_reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
    review_status: row.review_status,
    reviewed_at: row.reviewed_at,
    review_notes: row.review_notes,
    created_at: row.created_at,
    requires_official_review: row.review_status === "Suggested",
    caseA: {
      id: row.complaint_id_a,
      complaint_id: row.complaint_id_a,
      title: row.case_a_title,
      category: row.case_a_category,
      bureau: row.case_a_bureau,
      status: row.case_a_status,
      priority: row.case_a_priority,
      description: row.case_a_description,
      institution_id: row.case_a_institution_perm_id || row.case_a_institution_id,
      institution_name: row.case_a_institution_name,
      institution: {
        id: row.case_a_institution_id,
        aicte_permanent_id: row.case_a_institution_perm_id,
        name: row.case_a_institution_name
      }
    },
    caseB: {
      id: row.complaint_id_b,
      complaint_id: row.complaint_id_b,
      title: row.case_b_title,
      category: row.case_b_category,
      bureau: row.case_b_bureau,
      status: row.case_b_status,
      priority: row.case_b_priority,
      description: row.case_b_description,
      institution_id: row.case_b_institution_perm_id || row.case_b_institution_id,
      institution_name: row.case_b_institution_name,
      institution: {
        id: row.case_b_institution_id,
        aicte_permanent_id: row.case_b_institution_perm_id,
        name: row.case_b_institution_name
      }
    }
  }));

  return { overlaps, total };
}

/**
 * Get all related complaints for a specific complaint ID with bureau access verification.
 */
export async function getRelatedByComplaintId(complaintId, user = null) {
  // Confirm complaint exists first
  const checkSql = `SELECT complaint_id, bureau, originating_bureau FROM complaints WHERE complaint_id = $1;`;
  const checkRes = await query(checkSql, [complaintId]);
  if (checkRes.rows.length === 0) {
    return null;
  }

  const baseComplaint = checkRes.rows[0];

  // Bureau check: if user is scoped, verify they have permission to inspect this complaint
  if (user && (user.role === "BUREAU_HEAD" || user.role === "BUREAU_OFFICER" || user.role === "GRIEVANCE_OFFICER")) {
    if (!user.bureau) {
      const error = new Error(`User account with role '${user.role}' has no bureau assigned.`);
      error.code = "FORBIDDEN_BUREAU_ACCESS";
      error.statusCode = 403;
      throw error;
    }
    const isOwner = baseComplaint.bureau === user.bureau || baseComplaint.originating_bureau === user.bureau;
    if (!isOwner) {
      // Also check if any link involves their bureau
      const linkCheck = await query(
        `SELECT 1 FROM complaint_links cl
         JOIN complaints c ON (c.complaint_id = cl.complaint_id_a OR c.complaint_id = cl.complaint_id_b)
         WHERE (cl.complaint_id_a = $1 OR cl.complaint_id_b = $1) AND c.bureau = $2
         LIMIT 1;`,
        [complaintId, user.bureau]
      );
      if (linkCheck.rows.length === 0) {
        const error = new Error(`Access forbidden: Complaint '${complaintId}' belongs to another bureau.`);
        error.code = "FORBIDDEN_BUREAU_ACCESS";
        error.statusCode = 403;
        throw error;
      }
    }
  }

  const sql = `
    SELECT
      cl.id AS link_id,
      cl.similarity_score,
      cl.match_reasons,
      cl.review_status,
      cl.reviewed_at,
      cl.review_notes,
      cl.created_at,
      CASE
        WHEN cl.complaint_id_a = $1 THEN cl.complaint_id_b
        ELSE cl.complaint_id_a
      END AS related_complaint_id,
      c.title AS related_title,
      c.category AS related_category,
      c.bureau AS related_bureau,
      c.status AS related_status,
      c.priority AS related_priority,
      c.description AS related_description,
      i.id AS related_institution_id,
      i.aicte_permanent_id AS related_institution_perm_id,
      i.institution_name AS related_institution_name
    FROM complaint_links cl
    JOIN complaints c ON c.complaint_id = (
      CASE
        WHEN cl.complaint_id_a = $1 THEN cl.complaint_id_b
        ELSE cl.complaint_id_a
      END
    )
    JOIN institutions i ON c.institution_id = i.id
    WHERE cl.complaint_id_a = $1 OR cl.complaint_id_b = $1
    ORDER BY cl.similarity_score DESC;
  `;

  const result = await query(sql, [complaintId]);

  return {
    complaint_id: complaintId,
    related_cases: result.rows.map((row) => ({
      link_id: row.link_id,
      similarity_score: Number(row.similarity_score),
      match_reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
      review_status: row.review_status,
      review_notes: row.review_notes,
      requires_official_review: row.review_status === "Suggested",
      matched_complaint: {
        id: row.related_complaint_id,
        complaint_id: row.related_complaint_id,
        title: row.related_title,
        category: row.related_category,
        bureau: row.related_bureau,
        status: row.related_status,
        priority: row.related_priority,
        description: row.related_description,
        institution_id: row.related_institution_perm_id || row.related_institution_id,
        institution_name: row.related_institution_name,
        institution: {
          id: row.related_institution_id,
          aicte_permanent_id: row.related_institution_perm_id,
          name: row.related_institution_name
        }
      }
    }))
  };
}

/**
 * Returns overlap suggestions formatted for the legacy /api/complaints/related endpoint,
 * scoped by user bureau if caller is a bureau officer or head.
 */
export async function getLegacyRelatedFeed(user = null) {
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
    conditions.push(`(ca.bureau = $1 OR cb.bureau = $1)`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      cl.similarity_score,
      cl.match_reasons,
      cl.review_status,
      ca.complaint_id AS case_a_id,
      ca.bureau AS case_a_bureau,
      ca.category AS case_a_category,
      ca.description AS case_a_description,
      cb.complaint_id AS case_b_id,
      cb.bureau AS case_b_bureau,
      cb.category AS case_b_category,
      cb.description AS case_b_description
    FROM complaint_links cl
    JOIN complaints ca ON cl.complaint_id_a = ca.complaint_id
    JOIN complaints cb ON cl.complaint_id_b = cb.complaint_id
    ${whereClause}
    ORDER BY cl.similarity_score DESC;
  `;

  const result = await query(sql, params);

  const data = result.rows.map((row) => ({
    caseA: {
      id: row.case_a_id,
      bureau: row.case_a_bureau,
      category: row.case_a_category,
      description: row.case_a_description
    },
    caseB: {
      id: row.case_b_id,
      bureau: row.case_b_bureau,
      category: row.case_b_category,
      description: row.case_b_description
    },
    score: Number(row.similarity_score),
    reasons: Array.isArray(row.match_reasons) ? row.match_reasons : [],
    requiresOfficialReview: row.review_status === "Suggested"
  }));

  return {
    count: data.length,
    data
  };
}
