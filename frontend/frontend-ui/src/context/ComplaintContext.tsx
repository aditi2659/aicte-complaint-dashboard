import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Complaint, 
  Institution, 
  OverlapMatch, 
  AuditLog, 
  ComplaintStatus, 
  BureauCode, 
  TimelineAction,
  OverlapReviewStatus,
  SystemUser
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
  isOverdue: (complaint: Complaint) => boolean;
  getDaysRemainingOrOverdue: (complaint: Complaint) => { days: number; isOverdue: boolean };
  getComplaintById: (id: string) => Complaint | undefined;
  getInstitutionById: (id: string) => Institution | undefined;
  getStats: () => DashboardStats;
  addComplaint: (data: Partial<Complaint>) => Complaint;
  updateComplaintStatus: (id: string, newStatus: ComplaintStatus, remarks: string) => void;
  transferBureau: (id: string, targetBureau: BureauCode, reason: string, remarks: string) => void;
  reassignOfficer: (id: string, officerId: string, remarks: string) => void;
  addTimelineAction: (id: string, actionType: TimelineAction['actionType'], title: string, remarks: string, docRef?: string) => void;
  reviewOverlap: (id: string, status: OverlapReviewStatus, reviewNotes: string, relationshipType?: OverlapMatch['relationshipType']) => void;
  resetToInitialData: () => void;
}

const ComplaintContext = createContext<ComplaintContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_PREFIX = 'aicte_dashboard_';

export const ComplaintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}complaints`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_COMPLAINTS;
  });

  const [institutions, setInstitutions] = useState<Institution[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}institutions`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INSTITUTIONS;
  });

  const [overlaps, setOverlaps] = useState<OverlapMatch[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}overlaps`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_OVERLAPS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}audit_logs`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [currentUser, setCurrentUser] = useState<SystemUser>(SYSTEM_USERS[0]);

  // Persist to local storage for realistic state retention across actions
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}complaints`, JSON.stringify(complaints));
  }, [complaints]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}institutions`, JSON.stringify(institutions));
  }, [institutions]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}overlaps`, JSON.stringify(overlaps));
  }, [overlaps]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Overdue calculation rule:
  // An overdue condition is calculated if dueDate < current timestamp and status != 'DISPOSED'
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

  const addComplaint = (data: Partial<Complaint>): Complaint => {
    const newId = `CMP-${Date.now().toString().slice(-6)}`;
    const bureau = data.currentBureau || 'PGRC';
    const year = new Date().getFullYear();
    const caseNumber = `AICTE/${bureau}/${year}/${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    
    // Default due date: 30 days from now
    const due = new Date();
    due.setDate(due.getDate() + 30);

    const assigned = ASSIGNED_OFFICERS.find(o => o.bureau === bureau) || ASSIGNED_OFFICERS[0];
    const inst = institutions.find(i => i.id === data.institutionId) || institutions[0];

    const newComplaint: Complaint = {
      id: newId,
      caseNumber,
      institutionId: inst.id,
      institutionName: inst.name,
      aictePermanentId: inst.aictePermanentId,
      region: inst.region,
      state: inst.state,
      category: data.category || 'INFRASTRUCTURE_DEFICIENCY',
      categoryLabel: data.categoryLabel || 'Grievance matter',
      subject: data.subject || 'Complaint Subject',
      description: data.description || 'Details of the grievance filed.',
      currentBureau: bureau,
      assignedOfficer: data.assignedOfficer || assigned,
      status: 'RECEIVED',
      complainantType: data.complainantType || 'STUDENT',
      lodgingChannel: data.lodgingChannel || 'ONLINE_PORTAL',
      registrationDate: nowIso,
      lastActionDate: nowIso,
      dueDate: data.dueDate || due.toISOString(),
      priority: data.priority || 'NORMAL',
      hasActiveOverlap: false,
      linkedComplaintIds: [],
      supportingDocs: data.supportingDocs || [],
      timeline: [
        {
          id: `TL-${Date.now()}`,
          timestamp: nowIso,
          actionType: 'REGISTRATION',
          title: 'Complaint Registered in National Portal',
          performedBy: currentUser.name,
          officerRole: currentUser.role,
          bureau: currentUser.bureau,
          remarks: `Initial registration under ${bureau}. Case assigned to ${assigned.name}.`,
        },
      ],
    };

    setComplaints(prev => [newComplaint, ...prev]);

    // Update institution stats
    setInstitutions(prev => prev.map(item => {
      if (item.id === inst.id) {
        return {
          ...item,
          totalComplaints: item.totalComplaints + 1,
          pendingComplaints: item.pendingComplaints + 1,
          lastComplaintDate: nowIso.split('T')[0],
        };
      }
      return item;
    }));

    logAudit('COMPLAINT_REGISTERED', 'COMPLAINT', caseNumber, `New complaint registered for ${inst.name}`);
    return newComplaint;
  };

  const updateComplaintStatus = (id: string, newStatus: ComplaintStatus, remarks: string) => {
    const nowIso = new Date().toISOString();
    setComplaints(prev => prev.map(c => {
      if (c.id === id) {
        const timelineEntry: TimelineAction = {
          id: `TL-${Date.now()}`,
          timestamp: nowIso,
          actionType: newStatus === 'DISPOSED' ? 'FINAL_DISPOSAL_ORDER' : 'STATUS_CHANGE',
          title: `Status Updated to ${newStatus}`,
          performedBy: currentUser.name,
          officerRole: currentUser.role,
          bureau: currentUser.bureau,
          remarks: remarks || `Status transition from ${c.status} to ${newStatus}.`,
        };

        // Update institution counter if moving to DISPOSED
        if (newStatus === 'DISPOSED' && c.status !== 'DISPOSED') {
          setInstitutions(insts => insts.map(i => {
            if (i.id === c.institutionId) {
              return {
                ...i,
                disposedComplaints: i.disposedComplaints + 1,
                pendingComplaints: Math.max(0, i.pendingComplaints - 1),
                underProcessComplaints: Math.max(0, i.underProcessComplaints - 1),
              };
            }
            return i;
          }));
        }

        logAudit('STATUS_UPDATED', 'COMPLAINT', c.caseNumber, `Status updated to ${newStatus}. Remarks: ${remarks}`);

        return {
          ...c,
          status: newStatus,
          lastActionDate: nowIso,
          timeline: [timelineEntry, ...c.timeline],
        };
      }
      return c;
    }));
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

  const reviewOverlap = (
    id: string, 
    status: OverlapReviewStatus, 
    reviewNotes: string, 
    relationshipType?: OverlapMatch['relationshipType']
  ) => {
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
      // If confirmed, link the two complaints together for cross-reference (without auto-merging!)
      if (status === 'CONFIRMED_RELATED') {
        const cA = targetOverlap.complaintAId;
        const cB = targetOverlap.complaintBId;

        setComplaints(prev => prev.map(c => {
          if (c.id === cA && !c.linkedComplaintIds.includes(cB)) {
            return { ...c, linkedComplaintIds: [...c.linkedComplaintIds, cB] };
          }
          if (c.id === cB && !c.linkedComplaintIds.includes(cA)) {
            return { ...c, linkedComplaintIds: [...c.linkedComplaintIds, cA] };
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

    // Monthly trends (mocked realistic aggregated timeline)
    const monthlyTrends = [
      { month: 'May 2026', registered: 18, disposed: 14 },
      { month: 'Jun 2026', registered: 24, disposed: 19 },
      { month: 'Jul 2026', registered: 31, disposed: 22 },
      { month: 'Aug 2026', registered: 28, disposed: 25 },
      { month: 'Sep 2026', registered: 36, disposed: 29 },
      { month: 'Oct 2026', registered: 42, disposed: 33 },
    ];

    // Status distribution with unified theme palette
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
      const key = c.category.replace(/_/g, ' ');
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
