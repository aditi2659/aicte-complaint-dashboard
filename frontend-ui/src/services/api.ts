import { 
  Complaint, 
  Institution, 
  OverlapMatch, 
  AuditLog, 
  ComplaintStatus, 
  BureauCode, 
  OverlapReviewStatus 
} from '../types';

/**
 * AICTE Integrated Institution Complaint Monitoring & Status Portal API Service
 * 
 * Provides an abstracted service layer that models RESTful endpoints.
 * Currently backed by in-memory/localStorage state provider.
 * Can be switched to `fetch('/api/v1/...')` when connected to Express + PostgreSQL backend.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface ComplaintFilterParams {
  bureau?: BureauCode;
  region?: string;
  category?: string;
  status?: ComplaintStatus;
  officerId?: string;
  search?: string;
  isOverdue?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const ComplaintApiService = {
  // Complaints API
  async getComplaints(_params?: ComplaintFilterParams): Promise<ApiResponse<Complaint[]>> {
    // In production: return (await fetch(`/api/v1/complaints?${new URLSearchParams(params as any)}`)).json();
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  },

  async getComplaintById(id: string): Promise<ApiResponse<Complaint | null>> {
    // In production: return (await fetch(`/api/v1/complaints/${id}`)).json();
    return {
      success: true,
      data: null,
      timestamp: new Date().toISOString(),
    };
  },

  async createComplaint(payload: Partial<Complaint>): Promise<ApiResponse<Complaint>> {
    // In production: return (await fetch('/api/v1/complaints', { method: 'POST', body: JSON.stringify(payload) })).json();
    return {
      success: true,
      data: payload as Complaint,
      message: 'Complaint registered successfully in AICTE Central Ingestion Gateway.',
      timestamp: new Date().toISOString(),
    };
  },

  async updateStatus(id: string, status: ComplaintStatus, remarks: string): Promise<ApiResponse<{ id: string; status: ComplaintStatus }>> {
    // In production: return (await fetch(`/api/v1/complaints/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) })).json();
    return {
      success: true,
      data: { id, status },
      message: `Status updated to ${status}.`,
      timestamp: new Date().toISOString(),
    };
  },

  async transferBureau(id: string, targetBureau: BureauCode, reason: string, remarks: string): Promise<ApiResponse<{ id: string; targetBureau: BureauCode }>> {
    // In production: return (await fetch(`/api/v1/complaints/${id}/transfer`, { method: 'POST', body: JSON.stringify({ targetBureau, reason, remarks }) })).json();
    return {
      success: true,
      data: { id, targetBureau },
      message: `Case transferred to Bureau ${targetBureau}.`,
      timestamp: new Date().toISOString(),
    };
  },

  async reviewOverlap(id: string, reviewStatus: OverlapReviewStatus, notes: string): Promise<ApiResponse<{ id: string; reviewStatus: OverlapReviewStatus }>> {
    // In production: return (await fetch(`/api/v1/overlaps/${id}/review`, { method: 'POST', body: JSON.stringify({ reviewStatus, notes }) })).json();
    return {
      success: true,
      data: { id, reviewStatus },
      message: `Overlap reviewed and recorded as ${reviewStatus}.`,
      timestamp: new Date().toISOString(),
    };
  },

  // Institutions API
  async getInstitutions(): Promise<ApiResponse<Institution[]>> {
    // In production: return (await fetch('/api/v1/institutions')).json();
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  },

  // Audit Logs API
  async getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
    // In production: return (await fetch('/api/v1/audit-logs')).json();
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  },
};
