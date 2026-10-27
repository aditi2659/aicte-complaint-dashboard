export function validateComplaint(description) {
  if (typeof description !== 'string') {
    return { ok: false, error: 'Complaint description must be a non-empty string.' };
  }

  const trimmed = description.trim();

  if (trimmed.length === 0) {
    return { ok: false, error: 'Complaint description is required.' };
  }

  if (trimmed.length > 10000) {
    return { ok: false, error: 'Complaint description exceeds 10,000 characters.' };
  }

  return { ok: true, value: trimmed };
}
