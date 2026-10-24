import type {
  Complaint,
  Institution,
  OverlapMatch,
  AuditLog,
  ComplaintStatus,
  BureauCode,
  OverlapReviewStatus,
  SystemUser
} from '../types/index.ts';
import {
  mapBackendComplaintToUi,
  mapBackendOverlapToUi,
  mapBackendInstitutionToUi,
  mapUiReviewStatusToBackend,
  BUREAU_CODE_TO_NAME
} from './adapter.ts';

export const AUTH_TOKEN_KEY = 'aicte_auth_token';
export const AUTH_USER_KEY = 'aicte_auth_user';

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

export interface LoginResult {
  token: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    bureau: string | null;
  };
}

export const DEMO_CREDENTIALS = [
  {
    email: 'admin@aicte.gov.in',
    password: 'AICTE_Admin_9aF8c3e210b48d7120',
    name: 'AICTE Central Administrator',
    role: 'SUPER_ADMIN' as const,
    bureau: 'RB' as BureauCode,
  },
  {
    email: 'sdc.head@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Student Development Bureau Head',
    role: 'BUREAU_HEAD' as const,
    bureau: 'SDC' as BureauCode,
  },
  {
    email: 'sdc.officer@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Student Development Cell Officer',
    role: 'COMPLAINT_OFFICER' as const,
    bureau: 'SDC' as BureauCode,
  },
  {
    email: 'grc.officer@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Grievance Redressal Officer',
    role: 'COMPLAINT_OFFICER' as const,
    bureau: 'PGRC' as BureauCode,
  },
  {
    email: 'grievance.officer@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Central Grievance Redressal Officer',
    role: 'PGRC_MEMBER' as const,
    bureau: 'PGRC' as BureauCode,
  },
  {
    email: 'qac.officer@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Quality Assurance Officer',
    role: 'COMPLAINT_OFFICER' as const,
    bureau: 'RB' as BureauCode,
  },
  {
    email: 'auditor@aicte.gov.in',
    password: 'AICTE_Staff_7bE6d4c120f39a8231',
    name: 'Central Compliance Auditor',
    role: 'AUDITOR' as const,
    bureau: 'RB' as BureauCode,
  },
];

let unauthorizedListeners: Array<() => void> = [];

export const authService = {
  getToken(): string | null {
    try {
      return sessionStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getStoredUser(): SystemUser | null {
    try {
      const data = sessionStorage.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setSession(token: string, user: SystemUser): void {
    try {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save session:', e);
    }
  },

  clearSession(): void {
    try {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  },

  onUnauthorized(cb: () => void): () => void {
    unauthorizedListeners.push(cb);
    return () => {
      unauthorizedListeners = unauthorizedListeners.filter(l => l !== cb);
    };
  },

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      const code = json?.error?.code || 'AUTH_FAILED';
      const msg = json?.error?.message || `Login failed with status ${res.status}`;
      const err = new Error(msg);
      (err as any).code = code;
      (err as any).status = res.status;
      throw err;
    }

    return json.data;
  },
};

/**
 * Common fetch helper that automatically attaches Bearer tokens
 * and dispatches 401 unauthenticated notifications.
 */
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    authService.clearSession();
    unauthorizedListeners.forEach(listener => {
      try { listener(); } catch {}
    });
    const err = new Error('Session expired or authentication missing. Please log in.');
    (err as any).code = 'UNAUTHORIZED';
    (err as any).status = 401;
    throw err;
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok || json.success === false) {
    const code = json?.error?.code || 'API_ERROR';
    const message = json?.error?.message || `Request failed with HTTP ${res.status}`;
    const error = new Error(message);
    (error as any).code = code;
    (error as any).status = res.status;
    (error as any).details = json?.error?.details;
    throw error;
  }

  return json;
}

export const ComplaintApiService = {
  /**
   * Fetch authenticated complaints list from backend /api/v1/complaints
   */
  async getComplaints(params?: ComplaintFilterParams): Promise<ApiResponse<Complaint[]>> {
    const query = new URLSearchParams();
    if (params?.bureau) {
      const fullName = BUREAU_CODE_TO_NAME[params.bureau];
      if (fullName) query.set('bureau', fullName);
    }
    if (params?.status) {
      query.set('status', params.status);
    }
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const endpoint = `/api/v1/complaints${qs ? `?${qs}` : ''}`;
    const res = await apiRequest<{ success: boolean; data: any[]; meta?: any }>(endpoint);

    const complaints = (res.data || []).map(mapBackendComplaintToUi);

    return {
      success: true,
      data: complaints,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Fetch detailed complaint case including nested institution and audit history
   */
  async getComplaintById(id: string): Promise<ApiResponse<Complaint | null>> {
    const endpoint = `/api/v1/complaints/${encodeURIComponent(id)}`;
    const res = await apiRequest<{ success: boolean; data: any }>(endpoint);

    if (!res.data) {
      return {
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      };
    }

    const complaint = mapBackendComplaintToUi(res.data);
    return {
      success: true,
      data: complaint,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Fetch real cross-bureau overlap suggestions
   */
  async getOverlaps(): Promise<ApiResponse<OverlapMatch[]>> {
    const res = await apiRequest<{ success: boolean; data: any[] }>('/api/v1/overlaps');
    const overlaps = (res.data || []).map(mapBackendOverlapToUi);

    return {
      success: true,
      data: overlaps,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Review an overlap candidate (Confirmed or Dismissed) using authorized review API
   */
  async reviewOverlap(id: string, reviewStatus: OverlapReviewStatus, notes: string): Promise<ApiResponse<OverlapMatch>> {
    const backendStatus = mapUiReviewStatusToBackend(reviewStatus);
    const endpoint = `/api/v1/overlaps/${encodeURIComponent(id)}/review`;

    const res = await apiRequest<{ success: boolean; data: any }>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify({
        review_status: backendStatus,
        review_notes: notes ? notes.trim() : null,
      }),
    });

    const mapped = mapBackendOverlapToUi(res.data);

    return {
      success: true,
      data: mapped,
      message: `Overlap reviewed and recorded as ${reviewStatus}.`,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Fetch master institutions list
   */
  async getInstitutions(existingComplaints: Complaint[] = []): Promise<ApiResponse<Institution[]>> {
    const res = await apiRequest<{ success: boolean; data: any[] }>('/api/v1/institutions');
    const institutions = (res.data || []).map(inst => mapBackendInstitutionToUi(inst, existingComplaints));

    return {
      success: true,
      data: institutions,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Fetch system-wide dashboard summary metrics
   */
  async getDashboardSummary(): Promise<ApiResponse<any>> {
    const res = await apiRequest<{ success: boolean; data: any }>('/api/v1/dashboard/summary');
    return {
      success: true,
      data: res.data,
      timestamp: new Date().toISOString(),
    };
  },

  // Client-side action fallback stubs for unbuilt backend mutation endpoints
  async createComplaint(payload: Partial<Complaint>): Promise<ApiResponse<Complaint>> {
    return {
      success: true,
      data: payload as Complaint,
      message: 'Complaint registered in local session (backend mutation pending).',
      timestamp: new Date().toISOString(),
    };
  },

  async updateStatus(id: string, status: ComplaintStatus): Promise<ApiResponse<{ id: string; status: ComplaintStatus }>> {
    return {
      success: true,
      data: { id, status },
      message: `Status updated to ${status} in local session.`,
      timestamp: new Date().toISOString(),
    };
  },

  async transferBureau(id: string, targetBureau: BureauCode): Promise<ApiResponse<{ id: string; targetBureau: BureauCode }>> {
    return {
      success: true,
      data: { id, targetBureau },
      message: `Case transferred to ${targetBureau} in local session.`,
      timestamp: new Date().toISOString(),
    };
  },

  async getAuditLogs(): Promise<ApiResponse<AuditLog[]>> {
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    };
  },
};
