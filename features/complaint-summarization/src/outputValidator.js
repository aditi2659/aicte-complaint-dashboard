export const PROVISIONAL_CATEGORIES = [
  'Approval, Affiliation and Accreditation',
  'Admissions and Enrollment',
  'Infrastructure and Facilities',
  'Faculty and Staff',
  'Academic and Curriculum',
  'Fees and Financial Issues',
  'Examinations, Certificates and Documentation',
  'Placements and Career Services',
  'Regulatory Compliance',
  'Faculty Development and Training',
  'Other'
];

export function validateOutput(result) {
  if (!result || typeof result !== 'object') {
    return { ok: false, error: 'Output must be an object.' };
  }

  if (result.success !== true || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    return { ok: false, error: 'Output must use the success/data response envelope.' };
  }

  const topLevelKeys = Object.keys(result).sort();
  if (topLevelKeys.join(',') !== 'data,success') {
    return { ok: false, error: 'Output contains unsupported top-level fields.' };
  }

  const data = result.data;
  const dataKeys = Object.keys(data).sort();
  const expectedKeys = [
    'complaint_id',
    'key_issues',
    'requires_human_review',
    'suggested_category',
    'suggested_category_id',
    'summary'
  ].sort();
  if (dataKeys.join(',') !== expectedKeys.join(',')) {
    return { ok: false, error: 'Output data contains missing or unsupported fields.' };
  }

  if (typeof data.complaint_id !== 'string' || data.complaint_id.trim().length === 0) {
    return { ok: false, error: 'complaint_id must be a non-empty string supplied by the caller.' };
  }

  if (typeof data.summary !== 'string' || data.summary.trim().length === 0) {
    return { ok: false, error: 'summary must be a non-empty string.' };
  }

  if (!Array.isArray(data.key_issues) || data.key_issues.length < 1 || data.key_issues.length > 5) {
    return { ok: false, error: 'key_issues must be an array containing 1 to 5 strings.' };
  }

  if (!data.key_issues.every((issue) => typeof issue === 'string' && issue.trim().length > 0)) {
    return { ok: false, error: 'Each key issue must be a non-empty string.' };
  }

  if (!PROVISIONAL_CATEGORIES.includes(data.suggested_category)) {
    return { ok: false, error: 'suggested_category is not one of the allowed provisional categories.' };
  }

  if (data.suggested_category_id !== null) {
    return { ok: false, error: 'suggested_category_id must remain null until an approved mapping is supplied.' };
  }

  if (typeof data.requires_human_review !== 'boolean') {
    return { ok: false, error: 'requires_human_review must be a boolean.' };
  }

  return { ok: true, value: result };
}

export function validateModelOutput(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return { ok: false, error: 'Model output must be an object.' };
  }

  const keys = Object.keys(result).sort();
  if (keys.join(',') !== 'key_issues,suggested_category,summary') {
    return { ok: false, error: 'Model output must contain summary, key_issues, and suggested_category only.' };
  }

  if (typeof result.summary !== 'string' || result.summary.trim().length === 0) {
    return { ok: false, error: 'Model summary must be a non-empty string.' };
  }

  if (!Array.isArray(result.key_issues) || result.key_issues.length < 1 || result.key_issues.length > 5) {
    return { ok: false, error: 'Model key_issues must contain 1 to 5 strings.' };
  }

  if (!result.key_issues.every((issue) => typeof issue === 'string' && issue.trim().length > 0)) {
    return { ok: false, error: 'Each model key issue must be a non-empty string.' };
  }

  if (!PROVISIONAL_CATEGORIES.includes(result.suggested_category)) {
    return { ok: false, error: 'Model suggested_category is not one of the proposed categories.' };
  }

  return { ok: true, value: result };
}
