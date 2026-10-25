import type {
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  BureauCode,
  TimelineAction,
  OverlapMatch,
  OverlapReviewStatus,
  Institution
} from '../types/index.ts';

export const BUREAU_NAME_TO_CODE: Record<string, BureauCode> = {
  'Student Development Cell': 'SDC',
  'Grievance Redressal Cell': 'PGRC',
  'Approval Bureau': 'AB',
  'Policy & Academic Planning Bureau': 'PAPB',
  'Quality Assurance Cell': 'RB',
  'Faculty Development Bureau': 'FDB',
};

export const BUREAU_CODE_TO_NAME: Record<BureauCode, string> = {
  'SDC': 'Student Development Cell',
  'PGRC': 'Grievance Redressal Cell',
  'AB': 'Approval Bureau',
  'PAPB': 'Policy & Academic Planning Bureau',
  'RB': 'Quality Assurance Cell',
  'FDB': 'Faculty Development Bureau',
};

export function mapBackendStatusToUi(status?: string): ComplaintStatus {
  const s = (status || '').toLowerCase().trim();
  if (s === 'open') return 'PENDING';
  if (s === 'assigned' || s === 'under review') return 'UNDER_PROCESS';
  if (s === 'transferred') return 'TRANSFERRED';
  if (s === 'escalated') return 'ESCALATED';
  if (s === 'resolved' || s === 'dismissed') return 'DISPOSED';
  return 'PENDING';
}

export function mapUiStatusToBackend(status: ComplaintStatus): string {
  switch (status) {
    case 'PENDING':
    case 'RECEIVED':
      return 'Open';
    case 'UNDER_PROCESS':
      return 'Under Review';
    case 'TRANSFERRED':
      return 'Transferred';
    case 'ESCALATED':
      return 'Escalated';
    case 'DISPOSED':
      return 'Resolved';
    default:
      return 'Open';
  }
}

export function mapBackendPriorityToUi(priority?: string): 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' {
  const p = (priority || '').toUpperCase().trim();
  if (p === 'LOW') return 'LOW';
  if (p === 'MEDIUM') return 'NORMAL';
  if (p === 'HIGH') return 'HIGH';
  if (p === 'CRITICAL' || p === 'URGENT') return 'CRITICAL';
  return 'NORMAL';
}

export function mapUiPriorityToBackend(priority?: string): 'Low' | 'Medium' | 'High' | 'Critical' {
  const p = (priority || '').toUpperCase().trim();
  if (p === 'LOW') return 'Low';
  if (p === 'HIGH') return 'High';
  if (p === 'CRITICAL' || p === 'URGENT') return 'Critical';
  return 'Medium';
}

export function mapBackendCategoryToUi(cat?: string): { category: ComplaintCategory; categoryLabel: string } {
  const label = cat || 'General';
  const c = (cat || '').toLowerCase();
  if (c.includes('scholarship') || c.includes('fee') || c.includes('payment') || c.includes('salary')) {
    return { category: 'FACULTY_NON_PAYMENT', categoryLabel: label };
  }
  if (c.includes('hostel') || c.includes('infra') || c.includes('sanitation') || c.includes('equipment') || c.includes('laboratory')) {
    return { category: 'INFRASTRUCTURE_DEFICIENCY', categoryLabel: label };
  }
  if (c.includes('course') || c.includes('approval') || c.includes('affiliation')) {
    return { category: 'UNAPPROVED_COURSES', categoryLabel: label };
  }
  if (c.includes('ragging') || c.includes('safety') || c.includes('harassment')) {
    return { category: 'RAGGING_SAFETY_VIOLATION', categoryLabel: label };
  }
  if (c.includes('admission') || c.includes('intake')) {
    return { category: 'ADMISSION_IRREGULARITY', categoryLabel: label };
  }
  if (c.includes('exam') || c.includes('grade') || c.includes('result')) {
    return { category: 'EXAMINATION_FRAUD', categoryLabel: label };
  }
  return { category: 'GOVERNANCE_MALPRACTICE', categoryLabel: label };
}

export function mapBackendActionsToTimeline(actions: any[], complaintBureau: BureauCode): TimelineAction[] {
  if (!Array.isArray(actions) || actions.length === 0) return [];

  return actions.map((a, idx) => {
    let actionType: TimelineAction['actionType'] = 'NOTE_ADDED';
    const at = (a.action_type || '').toUpperCase();
    if (at === 'CREATED') actionType = 'REGISTRATION';
    else if (at === 'STATUS_CHANGE') actionType = 'STATUS_CHANGE';
    else if (at === 'BUREAU_TRANSFER') actionType = 'BUREAU_TRANSFER';
    else if (at === 'OVERLAP_LINKED' || at === 'OVERLAP_REVIEWED') actionType = 'STATUS_CHANGE';

    let remarks = a.notes || '';
    if (!remarks && a.details) {
      try {
        remarks = typeof a.details === 'string' ? a.details : JSON.stringify(a.details);
      } catch {
        remarks = '';
      }
    }

    return {
      id: a.id ? String(a.id) : `TL-${idx}-${Date.now()}`,
      timestamp: a.created_at || new Date().toISOString(),
      actionType,
      title: a.action || 'Administrative Action',
      performedBy: a.actor_name || 'System Official',
      officerRole: 'Staff',
      bureau: complaintBureau,
      remarks,
    };
  });
}

export function mapBackendComplaintToUi(raw: any): Complaint {
  const bureauCode = BUREAU_NAME_TO_CODE[raw.bureau] || 'SDC';
  const { category, categoryLabel } = mapBackendCategoryToUi(raw.category);
  const inst = raw.institution || {};

  const state = inst.state || raw.institution_state || 'Maharashtra';
  const region = (state === 'Maharashtra')
    ? 'WEST'
    : (state === 'Karnataka')
      ? 'SOUTH'
      : 'NORTH';

  const timeline = mapBackendActionsToTimeline(raw.actions || [], bureauCode);

  return {
    id: raw.complaint_id || raw.id,
    caseNumber: raw.complaint_id || raw.id,
    institutionId: inst.id || raw.institution_id || '',
    institutionName: inst.name || raw.institution_name || 'Technical Institute',
    aictePermanentId: inst.aicte_permanent_id || raw.aicte_permanent_id || raw.institution_permanent_id || 'INST-UNKNOWN',
    region,
    state,
    category,
    categoryLabel,
    subject: raw.title || raw.category || 'Untitled Complaint',
    description: raw.description || '',
    currentBureau: bureauCode,
    assignedOfficer: {
      id: raw.assigned_to || 'OFFICER-01',
      name: raw.assigned_officer_name || 'Designated Bureau Officer',
      designation: 'Grievance Officer',
      bureau: bureauCode,
      email: 'officer@aicte.gov.in',
      activeCases: 1,
    },
    status: mapBackendStatusToUi(raw.status),
    complainantType: 'STUDENT',
    lodgingChannel: 'ONLINE_PORTAL',
    registrationDate: raw.created_at || new Date().toISOString(),
    lastActionDate: raw.updated_at || raw.last_action_date || raw.created_at || new Date().toISOString(),
    dueDate: raw.due_date || new Date(Date.now() + 14 * 86400000).toISOString(),
    priority: mapBackendPriorityToUi(raw.priority),
    timeline,
    hasActiveOverlap: Boolean(raw.has_overlap),
    linkedComplaintIds: Array.isArray(raw.matched_case_ids) ? raw.matched_case_ids : [],
    supportingDocs: [],
  };
}

export function mapBackendOverlapToUi(raw: any): OverlapMatch {
  const rawStatus = raw.review_status || 'Suggested';
  let reviewStatus: OverlapReviewStatus = 'UNREVIEWED';
  if (rawStatus === 'Confirmed') reviewStatus = 'CONFIRMED_RELATED';
  else if (rawStatus === 'Dismissed') reviewStatus = 'DISMISSED';

  const caseA = raw.caseA || {};
  const caseB = raw.caseB || {};
  const instA = caseA.institution || {};
  const instB = caseB.institution || {};

  const samePermanentId = (caseA.institution_id && caseA.institution_id === caseB.institution_id) ||
    (instA.aicte_permanent_id && instA.aicte_permanent_id === instB.aicte_permanent_id);

  const similarityScore = Math.round(Number(raw.similarity_score || 0) * 100);

  return {
    id: String(raw.id),
    complaintAId: caseA.complaint_id || caseA.id || '',
    complaintBId: caseB.complaint_id || caseB.id || '',
    similarityScore,
    reviewStatus,
    detectedAt: raw.created_at || new Date().toISOString(),
    institutionMatch: {
      samePermanentId: Boolean(samePermanentId),
      nameMatchPercentage: samePermanentId ? 100 : 80,
      parentTrustMatch: true,
    },
    matchingCategories: [caseA.category, caseB.category].filter(Boolean),
    reasons: Array.isArray(raw.match_reasons) && raw.match_reasons.length > 0
      ? raw.match_reasons
      : ['Cross-bureau correlation detected'],
    reviewedBy: raw.reviewed_by ? String(raw.reviewed_by) : undefined,
    reviewedAt: raw.reviewed_at || undefined,
    reviewNotes: raw.review_notes || undefined,
    relationshipType: 'IDENTICAL_GRIEVANCE',
  };
}

export function mapUiReviewStatusToBackend(status: OverlapReviewStatus): 'Confirmed' | 'Dismissed' {
  if (status === 'CONFIRMED_RELATED') return 'Confirmed';
  return 'Dismissed';
}

export function mapBackendInstitutionToUi(raw: any, complaints: Complaint[]): Institution {
  const instComplaints = complaints.filter(c => c.aictePermanentId === raw.aicte_permanent_id);
  const state = raw.state || 'Maharashtra';
  const region = state === 'Maharashtra' ? 'WEST' : state === 'Karnataka' ? 'SOUTH' : 'NORTH';

  return {
    id: raw.id,
    aictePermanentId: raw.aicte_permanent_id,
    name: raw.institution_name,
    type: 'PRIVATE_SELF_FINANCED',
    address: `${raw.institution_name}, ${state}`,
    state,
    region,
    status: raw.approval_status === 'Approved' ? 'ACTIVE' : 'UNDER_INQUIRY',
    directorName: 'Director / Principal',
    contactEmail: raw.contact_email || 'info@institution.edu',
    contactPhone: raw.contact_phone || '+91-22-25550100',
    totalComplaints: instComplaints.length,
    pendingComplaints: instComplaints.filter(c => c.status === 'PENDING' || c.status === 'RECEIVED').length,
    underProcessComplaints: instComplaints.filter(c => c.status === 'UNDER_PROCESS').length,
    disposedComplaints: instComplaints.filter(c => c.status === 'DISPOSED').length,
    lastComplaintDate: instComplaints[0]?.registrationDate || raw.updated_at || new Date().toISOString(),
    accreditation: 'NBA / NAAC Accredited',
    approvedIntake: 600,
  };
}
