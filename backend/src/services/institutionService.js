import { query } from "../config/db.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * List institutions with filtering, pagination, and total count.
 */
export async function listInstitutions(filters = {}, pagination = { limit: 20, offset: 0 }) {
  const conditions = [];
  const params = [];

  if (filters.state) {
    params.push(filters.state);
    conditions.push(`state = $${params.length}`);
  }

  if (filters.approval_status) {
    params.push(filters.approval_status);
    conditions.push(`approval_status = $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    const idx = params.length;
    conditions.push(`(institution_name ILIKE $${idx} OR aicte_permanent_id ILIKE $${idx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Query total count
  const countSql = `SELECT COUNT(*)::INTEGER AS total FROM institutions ${whereClause};`;
  const countResult = await query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  // Query records
  const queryParams = [...params, pagination.limit, pagination.offset];
  const listSql = `
    SELECT
      id,
      aicte_permanent_id,
      institution_name,
      institution_type,
      state,
      district,
      pincode,
      contact_email,
      contact_phone,
      approval_status,
      created_at,
      updated_at
    FROM institutions
    ${whereClause}
    ORDER BY institution_name ASC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const listResult = await query(listSql, queryParams);
  return { institutions: listResult.rows, total };
}

/**
 * Get institution details by UUID or AICTE Permanent ID.
 */
export async function getInstitutionById(idOrPermId) {
  const isUuid = UUID_REGEX.test(idOrPermId);
  const sql = isUuid
    ? `
      SELECT
        id,
        aicte_permanent_id,
        institution_name,
        institution_type,
        state,
        district,
        pincode,
        contact_email,
        contact_phone,
        approval_status,
        created_at,
        updated_at
      FROM institutions
      WHERE id = $1;
    `
    : `
      SELECT
        id,
        aicte_permanent_id,
        institution_name,
        institution_type,
        state,
        district,
        pincode,
        contact_email,
        contact_phone,
        approval_status,
        created_at,
        updated_at
      FROM institutions
      WHERE aicte_permanent_id = $1;
    `;

  const result = await query(sql, [idOrPermId]);
  return result.rows[0] || null;
}

/**
 * Get complaints history for an institution.
 */
export async function getInstitutionComplaints(idOrPermId, filters = {}, pagination = { limit: 20, offset: 0 }, user = null) {
  const institution = await getInstitutionById(idOrPermId);
  if (!institution) {
    return null;
  }

  const conditions = ["c.institution_id = $1"];
  const params = [institution.id];

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

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const countSql = `SELECT COUNT(*)::INTEGER AS total FROM complaints c ${whereClause};`;
  const countResult = await query(countSql, params);
  const total = countResult.rows[0]?.total || 0;

  const queryParams = [...params, pagination.limit, pagination.offset];
  const listSql = `
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
      c.updated_at
    FROM complaints c
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length};
  `;

  const listResult = await query(listSql, queryParams);
  return {
    institution,
    complaints: listResult.rows,
    total
  };
}
