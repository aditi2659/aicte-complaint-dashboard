// AICTE Integrated Institution Complaint Monitoring & Status Dashboard Types

export type ComplaintStatus =
  | 'RECEIVED'
  | 'PENDING'
  | 'UNDER_PROCESS'
  | 'TRANSFERRED'
  | 'ESCALATED'
  | 'DISPOSED';

export type BureauCode =
  | 'RB'    // Regulation Bureau
  | 'PGRC'  // Public Grievance Redressal Cell
  | 'AB'    // Approval Bureau
  | 'PAPB'  // Policy & Academic Planning Bureau
  | 'FDB'   // Faculty Development Bureau
  | 'SDC';  // Skill Development Cell

export interface Bureau {
  code: BureauCode;
  name: string;
  headOfficer: string;
  description: string;
  activeCasesCount: number;
  color: string;
}

export type ComplaintCategory =
  | 'FACULTY_NON_PAYMENT'
  | 'EXCESS_CAPITATION_FEE'
  | 'INFRASTRUCTURE_DEFICIENCY'
  | 'UNAPPROVED_COURSES'
  | 'RAGGING_SAFETY_VIOLATION'
  | 'WITHHOLDING_CERTIFICATES'
  | 'ADMISSION_IRREGULARITY'
  | 'GOVERNANCE_MALPRACTICE'
  | 'EXAMINATION_FRAUD'
  | 'SEXUAL_HARASSMENT_ICC';

export type ComplainantType =
  | 'STUDENT'
  | 'FACULTY'
  | 'PARENT'
  | 'CITIZEN'
  | 'ANONYMOUS_WHISTLEBLOWER'
  | 'COURT_DIRECTIVE';

export type LodgingChannel =
  | 'ONLINE_PORTAL'
  | 'CPGRAMS_PGRC'
  | 'AICTE_DG_LETTER'
  | 'REGIONAL_OFFICE'
  | 'COURT_NOTICE';

export interface AssignedOfficer {
  id: string;
  name: string;
  designation: string;
  bureau: BureauCode;
  email: string;
  activeCases: number;
}

export interface TimelineAction {
  id: string;
  timestamp: string; // ISO date
  actionType:
    | 'REGISTRATION'
    | 'STATUS_CHANGE'
    | 'BUREAU_TRANSFER'
    | 'OFFICER_REASSIGNMENT'
    | 'NOTICE_ISSUED'
    | 'HEARING_SCHEDULED'
    | 'INSPECTION_ORDERED'
    | 'COMPLIANCE_RECEIVED'
    | 'FINAL_DISPOSAL_ORDER'
    | 'NOTE_ADDED';
  title: string;
  performedBy: string;
  officerRole: string;
  bureau: BureauCode;
  remarks: string;
  documentRef?: string;
}

export interface Complaint {
  id: string; // internal UUID
  caseNumber: string; // e.g. AICTE/RB/2026/0412
  institutionId: string;
  institutionName: string;
  aictePermanentId: string;
  region: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTRAL' | 'NORTH_WEST' | 'SOUTH_WEST';
  state: string;
  category: ComplaintCategory;
  categoryLabel: string;
  subject: string;
  description: string;
  currentBureau: BureauCode;
  assignedOfficer: AssignedOfficer;
  status: ComplaintStatus;
  complainantType: ComplainantType;
  lodgingChannel: LodgingChannel;
  registrationDate: string; // ISO format
  lastActionDate: string;   // ISO format
  dueDate: string;          // ISO format
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  timeline: TimelineAction[];
  hasActiveOverlap: boolean;
  linkedComplaintIds: string[]; // Confirmed related cases
  supportingDocs: Array<{
    id: string;
    name: string;
    size: string;
    uploadedAt: string;
    type: string;
  }>;
}

export type OverlapReviewStatus = 'UNREVIEWED' | 'CONFIRMED_RELATED' | 'DISMISSED';

export interface OverlapMatch {
  id: string;
  complaintAId: string;
  complaintBId: string;
  similarityScore: number; // 0 - 100
  reviewStatus: OverlapReviewStatus;
  detectedAt: string;
  institutionMatch: {
    samePermanentId: boolean;
    nameMatchPercentage: number;
    parentTrustMatch: boolean;
  };
  matchingCategories: string[];
  reasons: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  relationshipType?: 'IDENTICAL_GRIEVANCE' | 'FACULTY_STUDENT_CONCURRENT' | 'REGULATORY_INFRA_OVERLAP' | 'AFFILIATION_DISPUTE';
}

export interface Institution {
  id: string;
  aictePermanentId: string;
  name: string;
  type: 'GOVERNMENT' | 'PRIVATE_SELF_FINANCED' | 'DEEMED_UNIVERSITY' | 'CENTRAL_INSTITUTION';
  address: string;
  state: string;
  region: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTRAL' | 'NORTH_WEST' | 'SOUTH_WEST';
  status: 'ACTIVE' | 'DEFICIENT_STANDARDS' | 'UNDER_INQUIRY' | 'NO_ADMISSION_STATUS';
  directorName: string;
  contactEmail: string;
  contactPhone: string;
  totalComplaints: number;
  pendingComplaints: number;
  underProcessComplaints: number;
  disposedComplaints: number;
  lastComplaintDate: string;
  accreditation: string;
  approvedIntake: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  bureau: BureauCode;
  action: string;
  entityType: 'COMPLAINT' | 'INSTITUTION' | 'OVERLAP' | 'USER_ROLE';
  entityId: string;
  details: string;
  ipAddress: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'BUREAU_HEAD' | 'COMPLAINT_OFFICER' | 'PGRC_MEMBER' | 'AUDITOR';
  bureau: BureauCode;
  permissions: string[];
  lastLogin: string;
}
