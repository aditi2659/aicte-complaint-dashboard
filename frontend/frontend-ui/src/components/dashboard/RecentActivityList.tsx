import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaints } from '../../context/ComplaintContext';
import { BureauBadge } from '../common/Badge';
import {
  FileText,
  ArrowRight,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';

export const RecentActivityList: React.FC = () => {
  const navigate = useNavigate();
  const { complaints } = useComplaints();

  // Aggregate recent timeline actions across all complaints
  const activities: Array<{
    complaintId: string;
    caseNumber: string;
    institutionName: string;
    actionType: string;
    title: string;
    performedBy: string;
    timestamp: string;
    bureau: any;
    remarks: string;
  }> = [];

  complaints.forEach(c => {
    c.timeline.forEach(t => {
      activities.push({
        complaintId: c.id,
        caseNumber: c.caseNumber,
        institutionName: c.institutionName,
        actionType: t.actionType,
        title: t.title,
        performedBy: t.performedBy,
        timestamp: t.timestamp,
        bureau: t.bureau,
        remarks: t.remarks,
      });
    });
  });

  // Sort descending by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivities = activities.slice(0, 6);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'REGISTRATION':
        return <FileText size={13} className="text-[#C4F279]" />;
      case 'STATUS_CHANGE':
        return <Clock size={13} className="text-[#E5A93C]" />;
      case 'BUREAU_TRANSFER':
        return <ArrowRight size={13} className="text-[#FF8BCB]" />;
      case 'NOTICE_ISSUED':
        return <Send size={13} className="text-[#FF8BCB]" />;
      case 'FINAL_DISPOSAL_ORDER':
        return <CheckCircle2 size={13} className="text-[#C4F279]" />;
      default:
        return <AlertTriangle size={13} className="text-[#A6B7A8]" />;
    }
  };

  return (
    <div className="space-y-2.5">
      {recentActivities.map((act, idx) => (
        <div
          key={idx}
          onClick={() => navigate(`/complaints/${act.complaintId}`)}
          className="p-3 bg-[#1A241D] border border-[#35473A] hover:border-[#4E6654] hover:bg-[#202D24] cursor-pointer transition-all flex items-start justify-between gap-3 group relative"
        >
          {/* Subtle square pixel marker */}
          <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#35473A] group-hover:bg-[#C4F279] transition-colors" />

          <div className="flex items-start gap-2.5">
            <div className="p-1.5 bg-[#222F25] border border-[#35473A] shrink-0 mt-0.5">
              {getActionIcon(act.actionType)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#E6EFE5] group-hover:text-[#C4F279] transition-colors">
                  {act.caseNumber}
                </span>
                <BureauBadge bureau={act.bureau} size="sm" />
              </div>
              <div className="text-xs font-medium text-[#E6EFE5] mt-0.5">
                {act.title}
              </div>
              <p className="text-[11px] text-[#A6B7A8] line-clamp-1 mt-0.5">
                {act.remarks}
              </p>
              <div className="text-[10px] font-mono text-[#A6B7A8]/70 mt-1 flex items-center gap-2">
                <span>By: {act.performedBy}</span>
                <span>•</span>
                <span>{act.timestamp.split('T')[0]}</span>
              </div>
            </div>
          </div>

          <ArrowUpRight size={14} className="text-[#A6B7A8] group-hover:text-[#C4F279] transition-colors shrink-0 mt-1" />
        </div>
      ))}
    </div>
  );
};
