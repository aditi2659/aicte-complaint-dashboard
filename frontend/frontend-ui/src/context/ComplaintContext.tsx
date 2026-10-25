import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Complaint,
  Institution,
  OverlapMatch,
  AuditLog,
  ComplaintStatus,
  BureauCode,
  TimelineAction,
  OverlapReviewStatus,
  SystemUser,
  AnalyticsRiskCase,
  AnalyticsPriorityCase,
  AnalyticsPatterns,
  AnalyticsAlert
} from '../types';
import {
  INITIAL_COMPLAINTS,
  INSTITUTIONS,
  INITIAL_OVERLAPS,
  INITIAL_AUDIT_LOGS,
  ASSIGNED_OFFICERS,
  SYSTEM_USERS,
  BUREAUS
} from '../data/mockData';
import {
  ComplaintApiService,
  authService,
  DEMO_CREDENTIALS
} from '../services/api';
import { BUREAU_NAME_TO_CODE } from '../services/adapter';

export interface DashboardStats {
  total: number;
  pending: number;
  underProcess: number;
  disposed: number;
  transferred: number;
  escalated: number;
  overdue: number;
  openOverlapAlerts: number;
  bureauWorkload: Array<{
    code: BureauCode;
    name: string;
    total: number;
    pending: number;
    underProcess: number;
    disposed: number;
    overdue: number;
    color: string;
  }>;
  monthlyTrends: Array<{
    month: string;
    registered: number;
    disposed: number;
  }>;
  statusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  categoryDistribution: Array<{
    category: string;
    count: number;
    color: string;
  }>;
}

interface ComplaintContextType {
  complaints: Complaint[];
  institutions: Institution[];
  overlaps: OverlapMatch[];
  auditLogs: AuditLog[];
  currentUser: SystemUser;
  setCurrentUser: (user: SystemUser) => void;
  dataSource: 'api' | 'fallback';
  apiLoading: boolean;
  apiError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadFromApi: () => Promise<void>;
  useMockFallback: () => void;
  clearApiError: () => void;
  isOverdue: (complaint: Complaint) => boolean;
  getDaysRemainingOrOverdue: (complaint: Complaint) => { days: number; isOverdue: boolean };
  getComplaintById: (id: string) => Complaint | undefined;
  getInstitutionById: (id: string) => Institution | undefined;
  getStats: () => DashboardStats;
  addComplaint: (data: Partial<Complaint>) => Promise<Complaint>;
  updateComplaintStatus: (id: string, newStatus: ComplaintStatus, remarks: string) => Promise<Complaint>;
  transferBureau: (id: string, targetBureau: BureauCode, reason: string, remarks: string) => void;
  reassignOfficer: (id: string, officerId: string, remarks: string) => void;
  addTimelineAction: (id: string, actionType: TimelineAction['actionType'], title: string, remarks: string, docRef?: string) => void;
  reviewOverlap: (id: string, status: OverlapReviewStatus, reviewNotes: string, relationshipType?: OverlapMatch['relationshipType']) => Promise<void>;
  resetToInitialData: () => void;
  analyticsAlerts: AnalyticsAlert[];
  priorityCases: AnalyticsPriorityCase[];
  riskCases: AnalyticsRiskCase[];
  patterns: AnalyticsPatterns | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  reloadAnalytics: (limit?: number) => Promise<void>;
  fetchPriorityList: (limit?: number) => Promise<AnalyticsPriorityCase[]>;
}

const ComplaintContext = createContext<ComplaintContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'aicte_dashboard_';

export const ComplaintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
  const [institutions, setInstitutions] = useState<Institution[]>(INSTITUTIONS);
  const [overlaps, setOverlaps] = useState<OverlapMatch[]>(INITIAL_OVERLAPS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [currentUser, setCurrentUserState] = useState<SystemUser>(() => {
    return authService.getStoredUser() || SYSTEM_USERS[0];
  });

  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('fallback');
  const [apiLoading, setApiLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Analytics state loaded from /api/v1/analytics/*
  const [analyticsAlerts, setAnalyticsAlerts] = useState<AnalyticsAlert[]>([]);
  const [priorityCases, setPriorityCases] = useState<AnalyticsPriorityCase[]>([]);
  const [riskCases, setRiskCases] = useState<AnalyticsRiskCase[]>([]);
  const [patterns, setPatterns] = useState<AnalyticsPatterns | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const reloadAnalytics = useCallback(async (limit: number = 10) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const [alertsRes, priorityRes, riskRes, patternsRes] = await Promise.all([
        ComplaintApiService.getAlerts(),
        ComplaintApiService.getPriorityList(limit),
        ComplaintApiService.getRiskCases(),
        ComplaintApiService.getPatterns(),
      ]);

      setAnalyticsAlerts(alertsRes.data || []);
      setPriorityCases(priorityRes.data || []);
      setRiskCases(riskRes.data || []);
      setPatterns(patternsRes.data || { repeatedCategories: [], risingCategories: [], busyRegions: [] });
      setAnalyticsError(null);
    } catch (err: any) {
      console.warn('[ComplaintContext] Analytics load failed:', err.message);
      // Explicit error state: do not silently substitute mock data
      setAnalyticsError(err.message || 'Failed to fetch analytics from backend.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchPriorityList = useCallback(async (limit: number = 10): Promise<AnalyticsPriorityCase[]> => {
    try {
      const res = await ComplaintApiService.getPriorityList(limit);
      setPriorityCases(res.data || []);
      return res.data || [];
    } catch (err: any) {
      console.warn('[ComplaintContext] Priority list fetch failed:', err.message);
      setAnalyticsError(err.message || 'Failed to fetch priority cases.');
      throw err;
    }
  }, []);

  // Method to fetch live backend data from Express API
  const loadDataFromApi = useCallback(async () => {
    setApiLoading(true);
    try {
      const [compRes, ovrRes, instRes] = await Promise.all([
        ComplaintApiService.getComplaints(),
        ComplaintApiService.getOverlaps(),
        ComplaintApiService.getInstitutions(complaints),
      ]);

      setComplaints(compRes.data);
      setOverlaps(ovrRes.data);
      if (instRes.data && instRes.data.length > 0) {
        setInstitutions(instRes.data);
      }
      setDataSource('api');
      setApiError(null);
      // Also fetch fresh backend analytics
      reloadAnalytics();
    } catch (err: any) {
      console.warn('[ComplaintContext] Backend API request failed:', err.message);
      setDataSource('fallback');
      setApiError(err.message || 'Failed to fetch live records from /api/v1 backend.');
      throw err;
    } finally {
      setApiLoading(false);
    }
  }, [complaints, reloadAnalytics]);

  // Initial bootstrap: attempt authentication and live backend connection
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuthAndData = async () => {
      setApiLoading(true);
      try {
        let token = authService.getToken();

        // If no token exists, bootstrap with demo administrator
        if (!token) {
          const defaultCred = DEMO_CREDENTIALS[0];
          const loginData = await authService.login(defaultCred.email, defaultCred.password);
          token = loginData.token;

          const defaultUser: SystemUser = {
            id: loginData.user.id,
            name: loginData.user.full_name,
            email: loginData.user.email,
            role: 'SUPER_ADMIN',
            bureau: 'RB',
            permissions: ['VIEW_ALL', 'ASSIGN_OFFICER', 'TRANSFER_BUREAU', 'DISPOSE_CASE', 'REVIEW_OVERLAP'],
            lastLogin: new Date().toISOString(),
          };

          authService.setSession(token, defaultUser);
          if (isMounted) {
            setCurrentUserState(defaultUser);
          }
        }

        const [compRes, ovrRes, instRes] = await Promise.all([
          ComplaintApiService.getComplaints(),
          ComplaintApiService.getOverlaps(),
          ComplaintApiService.getInstitutions(),
        ]);

        if (isMounted) {
          setComplaints(compRes.data);
          setOverlaps(ovrRes.data);
          if (instRes.data && instRes.data.length > 0) {
            setInstitutions(instRes.data);
          }
          setDataSource('api');
          setApiError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setDataSource('fallback');
          setApiError(err.message || 'Unable to connect to live Express API. Running with local development fallback.');
        }
      } finally {
        if (isMounted) {
          setApiLoading(false);
        }
      }
    };

    bootstrapAuthAndData();

    const unsub = authService.onUnauthorized(() => {
      if (isMounted) {
        setDataSource('fallback');
        setApiError('Session expired or unauthorized (401). Please log in to restore live backend connectivity.');
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Login handler
  const login = async (email: string, password: string) => {
    setApiLoading(true);
    setApiError(null);
    try {
      const result = await authService.login(email, password);
      const bureauCode = result.user.bureau ? (BUREAU_NAME_TO_CODE[result.user.bureau] || 'RB') : 'RB';

      let uiRole: SystemUser['role'] = 'SUPER_ADMIN';
      if (result.user.role === 'BUREAU_HEAD') uiRole = 'BUREAU_HEAD';
      else if (result.user.role === 'BUREAU_OFFICER') uiRole = 'COMPLAINT_OFFICER';
      else if (result.user.role === 'GRIEVANCE_OFFICER') uiRole = 'PGRC_MEMBER';
      else if (result.user.role === 'AUDITOR') uiRole = 'AUDITOR';

      const authenticatedUser: SystemUser = {
        id: result.user.id,
        name: result.user.full_name,
        email: result.user.email,
        role: uiRole,
        bureau: bureauCode,
        permissions: ['VIEW_ALL', 'ASSIGN_OFFICER', 'TRANSFER_BUREAU', 'DISPOSE_CASE', 'REVIEW_OVERLAP'],
        lastLogin: new Date().toISOString(),
      };

      authService.setSession(result.token, authenticatedUser);
      setCurrentUserState(authenticatedUser);

      // Load complaints and overlaps scoped to this user
      const [compRes, ovrRes, instRes] = await Promise.all([
        ComplaintApiService.getComplaints(),
        ComplaintApiService.getOverlaps(),
        ComplaintApiService.getInstitutions(),
      ]);

      setComplaints(compRes.data);
      setOverlaps(ovrRes.data);
      if (instRes.data && instRes.data.length > 0) {
        setInstitutions(instRes.data);
      }
      setDataSource('api');
      setApiError(null);
      await reloadAnalytics();
    } catch (err: any) {
      setApiError(err.message || 'Login failed.');
      throw err;
    } finally {
      setApiLoading(false);
    }
  };

  const logout = () => {
    authService.clearSession();
    setDataSource('fallback');
    setAnalyticsAlerts([]);
    setPriorityCases([]);
    setRiskCases([]);
    setPatterns(null);
    setAnalyticsError(null);
    setApiError('Logged out. Operating in offline development fallback.');
  };

  const reloadFromApi = async () => {
    await loadDataFromApi();
  };

  const useMockFallback = () => {
    setComplaints(INITIAL_COMPLAINTS);
    setInstitutions(INSTITUTIONS);
    setOverlaps(INITIAL_OVERLAPS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setDataSource('fallback');
    setApiError('Explicit fallback enabled. Operating on local development mock data.');
  };

  const clearApiError = () => {
    setApiError(null);
  };

  // Custom user setter that auto-authenticates if switching to a known demo persona
  const setCurrentUser = (user: SystemUser) => {
    setCurrentUserState(user);
    const demo = DEMO_CREDENTIALS.find(d => d.email.toLowerCase() === user.email.toLowerCase());
    if (demo) {
      login(demo.email, demo.password).catch(err => {
        console.warn('Persona auto-login failed:', err.message);
      });
    }
  };

  const isOverdue = (complaint: Complaint): boolean => {
    if (complaint.status === 'DISPOSED') return false;
    const dueTime = new Date(complaint.dueDate).getTime();
    const nowTime = new Date().getTime();
    return dueTime < nowTime;
  };

  const getDaysRemainingOrOverdue = (complaint: Complaint): { days: number; isOverdue: boolean } => {
    const dueTime = new Date(complaint.dueDate).getTime();
    const nowTime = new Date().getTime();
    const diffMs = dueTime - nowTime;
    const diffDays = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return {
      days: diffDays,
      isOverdue: diffMs < 0 && complaint.status !== 'DISPOSED',
    };
  };

  const getComplaintById = (id: string): Complaint | undefined => {
    return complaints.find(c => c.id === id || c.caseNumber === id);
  };

  const getInstitutionById = (id: string): Institution | undefined => {
    return institutions.find(i => i.id === id || i.aictePermanentId === id);
  };

  const logAudit = (action: string, entityType: AuditLog['entityType'], entityId: string, details: string) => {
    const newLog: AuditLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser.name,
      role: currentUser.role,
      bureau: currentUser.bureau,
      action,
      entityType,
      entityId,
      details,
      ipAddress: '10.14.88.10',
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const addComplaint = async (data: Partial<Complaint>): Promise<Complaint> => {
    try {
      const res = await ComplaintApiService.createComplaint(data);
      const newComplaint = res.data;
      setComplaints(prev => [newComplaint, ...prev.filter(c => c.id !== newComplaint.id)]);
      logAudit(
        'COMPLAINT_REGISTERED',
        'COMPLAINT',
        newComplaint.caseNumber || newComplaint.id,
        `Registered with category ${newComplaint.categoryLabel || newComplaint.category}`
      );
      // Refresh complaints and analytics in background
      loadDataFromApi().catch(err => console.warn('[ComplaintContext] Refresh complaints failed:', err.message));
      reloadAnalytics().catch(err => console.warn('[ComplaintContext] Reload analytics failed:', err.message));
      return newComplaint;
    } catch (err: any) {
      console.error('[ComplaintContext] Failed to register complaint:', err.message);
      throw err;
    }
  };

  const updateComplaintStatus = async (id: string, newStatus: ComplaintStatus, remarks: string): Promise<Complaint> => {
    try {
      const res = await ComplaintApiService.updateStatus(id, newStatus, remarks);
      const updated = res.data;
      setComplaints(prev => prev.map(c => (c.id === id ? updated : c)));
      logAudit(
        'STATUS_UPDATED',
        'COMPLAINT',
        updated.caseNumber || updated.id,
        `Status updated to ${newStatus}. Remarks: ${remarks}`
      );
      // Refresh complaints and analytics in background
      loadDataFromApi().catch(err => console.warn('[ComplaintContext] Refresh complaints failed:', err.message));
      reloadAnalytics().catch(err => console.warn('[ComplaintContext] Reload analytics failed:', err.message));
      return updated;
    } catch (err: any) {
      console.error('[ComplaintContext] Failed to update complaint status:', err.message);
      throw err;
    }
  };

  const transferBureau = (id: string, targetBureau: BureauCode, reason: string, remarks: string) => {
    const nowIso = new Date().toISOString();
    const targetOfficer = ASSIGNED_OFFICERS.find(o => o.bureau === targetBureau) || ASSIGNED_OFFICERS[0];

    setComplaints(prev => prev.map(c => {
      if (c.id === id) {
        const timelineEntry: TimelineAction = {
          id: `TL-${Date.now()}`,
          timestamp: nowIso,
          actionType: 'BUREAU_TRANSFER',
          title: `Transferred from ${c.currentBureau} to ${targetBureau}`,
          performedBy: currentUser.name,
          officerRole: currentUser.role,
          bureau: currentUser.bureau,
          remarks: `Transfer Reason: ${reason}. Remarks: ${remarks}. Handed over to ${targetOfficer.name}.`,
        };

        logAudit('BUREAU_TRANSFER', 'COMPLAINT', c.caseNumber, `Transferred from ${c.currentBureau} to ${targetBureau}. Reason: ${reason}`);

        return {
          ...c,
          currentBureau: targetBureau,
          assignedOfficer: targetOfficer,
          status: 'TRANSFERRED',
          lastActionDate: nowIso,
          timeline: [timelineEntry, ...c.timeline],
        };
      }
      return c;
    }));
  };

  const reassignOfficer = (id: string, officerId: string, remarks: string) => {
    const nowIso = new Date().toISOString();
    const officer = ASSIGNED_OFFICERS.find(o => o.id === officerId);
    if (!officer) return;

    setComplaints(prev => prev.map(c => {
      if (c.id === id) {
        const timelineEntry: TimelineAction = {
          id: `TL-${Date.now()}`,
          timestamp: nowIso,
          actionType: 'OFFICER_REASSIGNMENT',
          title: `Reassigned to ${officer.name} (${officer.designation})`,
          performedBy: currentUser.name,
          officerRole: currentUser.role,
          bureau: currentUser.bureau,
          remarks: remarks || `Case reassigned within ${officer.bureau}.`,
        };

        logAudit('OFFICER_REASSIGNED', 'COMPLAINT', c.caseNumber, `Reassigned to ${officer.name}. Remarks: ${remarks}`);

        return {
          ...c,
          assignedOfficer: officer,
          lastActionDate: nowIso,
          timeline: [timelineEntry, ...c.timeline],
        };
      }
      return c;
    }));
  };

  const addTimelineAction = (
    id: string,
    actionType: TimelineAction['actionType'],
    title: string,
    remarks: string,
    docRef?: string
  ) => {
    const nowIso = new Date().toISOString();
    setComplaints(prev => prev.map(c => {
      if (c.id === id) {
        const timelineEntry: TimelineAction = {
          id: `TL-${Date.now()}`,
          timestamp: nowIso,
          actionType,
          title,
          performedBy: currentUser.name,
          officerRole: currentUser.role,
          bureau: currentUser.bureau,
          remarks,
          documentRef: docRef,
        };

        logAudit(actionType, 'COMPLAINT', c.caseNumber, `Action recorded: ${title}. Remarks: ${remarks}`);

        return {
          ...c,
          lastActionDate: nowIso,
          timeline: [timelineEntry, ...c.timeline],
        };
      }
      return c;
    }));
  };

  // Real reviewOverlap calling the authorized review API
  const reviewOverlap = async (
    id: string,
    status: OverlapReviewStatus,
    reviewNotes: string,
    relationshipType?: OverlapMatch['relationshipType']
  ) => {
    const token = authService.getToken();

    if (dataSource === 'api' || token) {
      try {
        const res = await ComplaintApiService.reviewOverlap(id, status, reviewNotes);
        // Update the overlap in state
        setOverlaps(prev => prev.map(o => o.id === id ? res.data : o));

        // Re-fetch complaints from API to reflect updated overlap flags and matched case IDs
        try {
          const compRes = await ComplaintApiService.getComplaints();
          setComplaints(compRes.data);
        } catch (e) {
          console.warn('Failed to refresh complaints after overlap review:', e);
        }

        logAudit(
          status === 'CONFIRMED_RELATED' ? 'OVERLAP_CONFIRMED' : 'OVERLAP_DISMISSED',
          'OVERLAP',
          id,
          `Live backend review recorded: ${status}. Notes: ${reviewNotes}`
        );
        return;
      } catch (err: any) {
        console.error('API overlap review error:', err);
        setApiError(err.message || 'Failed to record overlap review on backend.');
        throw err;
      }
    }

    // Local fallback when running offline
    const nowIso = new Date().toISOString();
    let targetOverlap: OverlapMatch | undefined;

    setOverlaps(prev => prev.map(o => {
      if (o.id === id) {
        targetOverlap = {
          ...o,
          reviewStatus: status,
          reviewNotes,
          relationshipType: relationshipType || o.relationshipType,
          reviewedBy: `${currentUser.name} (${currentUser.role})`,
          reviewedAt: nowIso,
        };
        return targetOverlap;
      }
      return o;
    }));

    if (targetOverlap) {
      if (status === 'CONFIRMED_RELATED') {
        const cA = targetOverlap.complaintAId;
        const cB = targetOverlap.complaintBId;

        setComplaints(prev => prev.map(c => {
          if (c.id === cA && !c.linkedComplaintIds.includes(cB)) {
            return { ...c, linkedComplaintIds: [...c.linkedComplaintIds, cB], hasActiveOverlap: true };
          }
          if (c.id === cB && !c.linkedComplaintIds.includes(cA)) {
            return { ...c, linkedComplaintIds: [...c.linkedComplaintIds, cA], hasActiveOverlap: true };
          }
          return c;
        }));
      }

      logAudit(
        status === 'CONFIRMED_RELATED' ? 'OVERLAP_CONFIRMED' : 'OVERLAP_DISMISSED',
        'OVERLAP',
        id,
        `Overlap marked as ${status}. Notes: ${reviewNotes}`
      );
    }
  };

  const resetToInitialData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}complaints`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}institutions`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}overlaps`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}audit_logs`);
    setComplaints(INITIAL_COMPLAINTS);
    setInstitutions(INSTITUTIONS);
    setOverlaps(INITIAL_OVERLAPS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setDataSource('fallback');
    setApiError('Reset to initial local mock baseline.');
  };

  const getStats = (): DashboardStats => {
    let pendingCount = 0;
    let underProcessCount = 0;
    let disposedCount = 0;
    let transferredCount = 0;
    let escalatedCount = 0;
    let overdueCount = 0;

    complaints.forEach(c => {
      if (c.status === 'PENDING' || c.status === 'RECEIVED') pendingCount++;
      if (c.status === 'UNDER_PROCESS') underProcessCount++;
      if (c.status === 'DISPOSED') disposedCount++;
      if (c.status === 'TRANSFERRED') transferredCount++;
      if (c.status === 'ESCALATED') escalatedCount++;
      if (isOverdue(c)) overdueCount++;
    });

    const openOverlapAlerts = overlaps.filter(o => o.reviewStatus === 'UNREVIEWED').length;

    // Bureau-wise breakdown
    const bureauWorkload = BUREAUS.map(b => {
      const bComplaints = complaints.filter(c => c.currentBureau === b.code);
      return {
        code: b.code,
        name: b.name,
        total: bComplaints.length,
        pending: bComplaints.filter(c => c.status === 'PENDING' || c.status === 'RECEIVED').length,
        underProcess: bComplaints.filter(c => c.status === 'UNDER_PROCESS').length,
        disposed: bComplaints.filter(c => c.status === 'DISPOSED').length,
        overdue: bComplaints.filter(c => isOverdue(c)).length,
        color: b.color,
      };
    });

    // Monthly trends
    const monthlyTrends = [
      { month: 'May 2026', registered: 18, disposed: 14 },
      { month: 'Jun 2026', registered: 24, disposed: 19 },
      { month: 'Jul 2026', registered: 31, disposed: 22 },
      { month: 'Aug 2026', registered: 28, disposed: 25 },
      { month: 'Sep 2026', registered: 36, disposed: 29 },
      { month: 'Oct 2026', registered: 42, disposed: 33 },
    ];

    // Status distribution
    const statusDistribution = [
      { name: 'Under Process', value: underProcessCount, color: '#C4F279' },
      { name: 'Pending / Received', value: pendingCount, color: '#E5A93C' },
      { name: 'Escalated', value: escalatedCount, color: '#FF8BCB' },
      { name: 'Transferred', value: transferredCount, color: '#7C9C82' },
      { name: 'Disposed', value: disposedCount, color: '#435C49' },
    ];

    // Category distribution
    const catMap: Record<string, number> = {};
    complaints.forEach(c => {
      const key = (c.categoryLabel || c.category || 'General').replace(/_/g, ' ');
      catMap[key] = (catMap[key] || 0) + 1;
    });

    const colors = ['#C4F279', '#FF8BCB', '#8CB994', '#E5A93C', '#5D8265', '#A6B7A8', '#7C9C82'];
    const categoryDistribution = Object.keys(catMap).map((cat, idx) => ({
      category: cat,
      count: catMap[cat],
      color: colors[idx % colors.length],
    }));

    return {
      total: complaints.length,
      pending: pendingCount,
      underProcess: underProcessCount,
      disposed: disposedCount,
      transferred: transferredCount,
      escalated: escalatedCount,
      overdue: overdueCount,
      openOverlapAlerts,
      bureauWorkload,
      monthlyTrends,
      statusDistribution,
      categoryDistribution,
    };
  };

  return (
    <ComplaintContext.Provider
      value={{
        complaints,
        institutions,
        overlaps,
        auditLogs,
        currentUser,
        setCurrentUser,
        dataSource,
        apiLoading,
        apiError,
        login,
        logout,
        reloadFromApi,
        useMockFallback,
        clearApiError,
        isOverdue,
        getDaysRemainingOrOverdue,
        getComplaintById,
        getInstitutionById,
        getStats,
        addComplaint,
        updateComplaintStatus,
        transferBureau,
        reassignOfficer,
        addTimelineAction,
        reviewOverlap,
        resetToInitialData,
        analyticsAlerts,
        priorityCases,
        riskCases,
        patterns,
        analyticsLoading,
        analyticsError,
        reloadAnalytics,
        fetchPriorityList,
      }}
    >
      {children}
    </ComplaintContext.Provider>
  );
};

export const useComplaints = () => {
  const context = useContext(ComplaintContext);
  if (!context) {
    throw new Error('useComplaints must be used within a ComplaintProvider');
  }
  return context;
};
