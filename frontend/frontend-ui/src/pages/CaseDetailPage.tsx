import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { StatusBadge, BureauBadge, PriorityBadge } from '../components/common/Badge';
import { StatusUpdateModal } from '../components/complaints/StatusUpdateModal';
import { TransferBureauModal } from '../components/complaints/TransferBureauModal';
import { ReassignOfficerModal } from '../components/complaints/ReassignOfficerModal';
import {
  ArrowLeft,
  Building2,
  Clock,
  User,
  FileText,
  GitMerge,
  Download,
  MessageSquarePlus,
  ArrowRightLeft,
  Edit3,
  FileCheck,
  ExternalLink
} from 'lucide-react';
import { TimelineAction } from '../types';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getComplaintById, isOverdue, getDaysRemainingOrOverdue, addTimelineAction, overlaps } = useComplaints();

  const complaint = getComplaintById(id || '');

  // Modals state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // New timeline action form state
  const [actionTitle, setActionTitle] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionType, setActionType] = useState<TimelineAction['actionType']>('NOTE_ADDED');
  const [showActionForm, setShowActionForm] = useState(false);

  if (!complaint) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-[#E6EFE5]">Complaint Dossier Not Found</h2>
        <p className="text-sm text-[#A6B7A8]">
          The requested case number or identifier <span className="font-mono text-[#C4F279]">{id}</span> does not exist in the central repository.
        </p>
        <button
          onClick={() => navigate('/complaints')}
          className="px-4 py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono"
        >
          Return to Complaint Registry
        </button>
      </div>
    );
  }

  const overdue = isOverdue(complaint);
  const { days } = getDaysRemainingOrOverdue(complaint);

  // Related overlaps involving this complaint
  const relatedOverlaps = overlaps.filter(
    o => o.complaintAId === complaint.id || o.complaintBId === complaint.id
  );

  const handleAddActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim() || !actionRemarks.trim()) return;

    addTimelineAction(complaint.id, actionType, actionTitle, actionRemarks);
    setActionTitle('');
    setActionRemarks('');
    setShowActionForm(false);
  };

  const getTimelineBadge = (type: TimelineAction['actionType']) => {
    switch (type) {
      case 'REGISTRATION':
        return 'bg-[#C4F279]/10 text-[#C4F279] border-[#C4F279]/40';
      case 'STATUS_CHANGE':
        return 'bg-[#E5A93C]/12 text-[#E5A93C] border-[#E5A93C]/40';
      case 'BUREAU_TRANSFER':
        return 'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/50';
      case 'OFFICER_REASSIGNMENT':
        return 'bg-[#222F25] text-[#8CB994] border-[#35473A]';
      case 'NOTICE_ISSUED':
        return 'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/50';
      case 'HEARING_SCHEDULED':
        return 'bg-[#E5A93C]/12 text-[#E5A93C] border-[#E5A93C]/40';
      case 'INSPECTION_ORDERED':
        return 'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/50';
      case 'FINAL_DISPOSAL_ORDER':
        return 'bg-[#C4F279]/15 text-[#C4F279] border-[#C4F279]/50';
      default:
        return 'bg-[#222F25] text-[#A6B7A8] border-[#35473A]';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/complaints')}
          className="flex items-center gap-1.5 text-xs font-mono text-[#A6B7A8] hover:text-[#E6EFE5] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Complaint Registry</span>
        </button>

        <div className="text-[11px] font-mono text-[#A6B7A8]">
          Case UID: <span className="text-[#E6EFE5]">{complaint.id}</span>
        </div>
      </div>

      {/* Main Dossier Header Banner */}
      <div className="p-6 border border-[#35473A] bg-[#1A241D] relative overflow-hidden shadow-2xl shadow-black/40">
        <div className={`absolute top-0 right-0 w-3 h-3 ${overdue ? 'bg-[#FF8BCB]' : 'bg-[#C4F279]'}`} />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#35473A]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
              <span className="font-mono text-xl font-black text-[#E6EFE5] tracking-wide">
                {complaint.caseNumber}
              </span>
              <BureauBadge bureau={complaint.currentBureau} />
              <StatusBadge status={complaint.status} isOverdue={overdue} />
              <PriorityBadge priority={complaint.priority} />
            </div>
            <h1 className="text-base font-bold text-[#E6EFE5] max-w-3xl">
              {complaint.subject}
            </h1>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono transition-colors shadow-xs"
            >
              <Edit3 size={13} />
              <span>Update Status</span>
            </button>

            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF8BCB] hover:bg-[#F278BA] text-[#101713] text-xs font-bold font-mono transition-colors shadow-xs"
            >
              <ArrowRightLeft size={13} />
              <span>Transfer Bureau</span>
            </button>

            <button
              onClick={() => setShowReassignModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#222F25] hover:bg-[#2E3F32] text-[#E6EFE5] text-xs font-semibold font-mono border border-[#35473A] transition-colors"
            >
              <User size={13} />
              <span>Reassign</span>
            </button>
          </div>
        </div>

        {/* Quick Metadata Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs font-mono">
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Assigned Officer</div>
            <div className="font-bold text-[#E6EFE5] mt-0.5">{complaint.assignedOfficer.name}</div>
            <div className="text-[10px] text-[#A6B7A8]">{complaint.assignedOfficer.designation}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Registration Date</div>
            <div className="font-bold text-[#E6EFE5] mt-0.5">{complaint.registrationDate.split('T')[0]}</div>
            <div className="text-[10px] text-[#A6B7A8]">Via {complaint.lodgingChannel}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Resolution SLA Due</div>
            <div className="font-bold text-[#E6EFE5] mt-0.5">{complaint.dueDate.split('T')[0]}</div>
            <div className={`text-[10px] font-bold ${overdue ? 'text-[#FF8BCB]' : 'text-[#C4F279]'}`}>
              {overdue ? `${days} Days Overdue` : `${days} Days Remaining`}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Complainant Category</div>
            <div className="font-bold text-[#C4F279] mt-0.5">{complaint.complainantType}</div>
            <div className="text-[10px] text-[#A6B7A8]">Category: {complaint.category.replace(/_/g, ' ')}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Dossier Info & Right Chronological Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Respondent Institution Quick Card */}
          <div className="p-4 border border-[#35473A] bg-[#1A241D] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8] font-semibold flex items-center gap-1.5">
                <Building2 size={13} className="text-[#C4F279]" />
                <span>Respondent Institution</span>
              </span>
              <button
                onClick={() => navigate(`/institutions/${complaint.institutionId}`)}
                className="text-[10px] font-mono text-[#C4F279] hover:underline flex items-center gap-1"
              >
                <span>View Full Profile</span>
                <ExternalLink size={10} />
              </button>
            </div>

            <div>
              <div className="font-bold text-[#E6EFE5] text-sm">
                {complaint.institutionName}
              </div>
              <div className="text-xs font-mono text-[#A6B7A8] mt-0.5">
                AICTE Permanent ID: <span className="text-[#E6EFE5]">{complaint.aictePermanentId}</span>
              </div>
              <div className="text-xs text-[#A6B7A8] mt-1">
                Region: <span className="font-mono text-[#E6EFE5]">{complaint.region}</span> • State: <span className="text-[#E6EFE5]">{complaint.state}</span>
              </div>
            </div>
          </div>

          {/* Full Complaint Statement */}
          <div className="p-4 border border-[#35473A] bg-[#1A241D] space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8] font-semibold flex items-center gap-1.5">
              <FileText size={13} className="text-[#C4F279]" />
              <span>Complaint Narrative & Statement</span>
            </span>
            <div className="text-xs text-[#E6EFE5] leading-relaxed bg-[#222F25] p-3 border border-[#35473A] whitespace-pre-line">
              {complaint.description}
            </div>
          </div>

          {/* Cross-Bureau Overlap Flags */}
          {relatedOverlaps.length > 0 && (
            <div className="p-4 border border-[#FF8BCB]/40 bg-[#FF8BCB]/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#FF8BCB] font-bold flex items-center gap-1.5">
                  <GitMerge size={14} className="text-[#FF8BCB]" />
                  <span>Cross-Bureau Overlap Nexus ({relatedOverlaps.length})</span>
                </span>
                <button
                  onClick={() => navigate('/overlaps')}
                  className="text-[10px] font-mono text-[#FF8BCB] hover:underline"
                >
                  Manage in Overlap Centre →
                </button>
              </div>

              <div className="space-y-2">
                {relatedOverlaps.map(o => (
                  <div key={o.id} className="p-2.5 bg-[#1A241D] border border-[#35473A] text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[11px] text-[#FF8BCB] font-bold">
                        {o.similarityScore}% Match Detected
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#222F25] text-[#A6B7A8]">
                        {o.reviewStatus}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#A6B7A8] font-sans line-clamp-2">
                      {o.reasons[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting Documents */}
          <div className="p-4 border border-[#35473A] bg-[#1A241D] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8] font-semibold flex items-center gap-1.5">
              <FileCheck size={13} className="text-[#8CB994]" />
              <span>Evidentiary Dossier ({complaint.supportingDocs.length})</span>
            </span>

            <div className="space-y-2">
              {complaint.supportingDocs.map(doc => (
                <div key={doc.id} className="p-2.5 bg-[#222F25] border border-[#35473A] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-[#A6B7A8]" />
                    <div>
                      <div className="font-mono text-[#E6EFE5] text-[11px] line-clamp-1">{doc.name}</div>
                      <div className="text-[10px] font-mono text-[#A6B7A8]">{doc.size} • Uploaded {doc.uploadedAt}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => alert(`Simulating secure download of ${doc.name} from AICTE document repository.`)}
                    className="p-1 bg-[#1A241D] text-[#A6B7A8] hover:text-[#E6EFE5] border border-[#35473A]"
                    title="Download"
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chronological Action Timeline (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#35473A]">
              <div>
                <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide flex items-center gap-2">
                  <span>Chronological Case Timeline</span>
                  <span className="text-xs font-mono font-normal text-[#C4F279] bg-[#C4F279]/10 px-2 py-0.5 border border-[#C4F279]/40">
                    {complaint.timeline.length} Actions Recorded
                  </span>
                </h3>
                <p className="text-[11px] text-[#A6B7A8]">
                  Immutable record of statutory notices, hearings, transfers, and disposals.
                </p>
              </div>

              <button
                onClick={() => setShowActionForm(!showActionForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#222F25] hover:bg-[#2E3F32] text-[#E6EFE5] text-xs font-semibold font-mono border border-[#35473A] transition-colors"
              >
                <MessageSquarePlus size={13} />
                <span>Record Action / Note</span>
              </button>
            </div>

            {/* Action Recording Form */}
            {showActionForm && (
              <form onSubmit={handleAddActionSubmit} className="p-4 bg-[#222F25] border border-[#C4F279]/40 space-y-3 text-xs">
                <div className="font-bold text-[#C4F279] font-mono text-[11px] uppercase tracking-wider">
                  Add Official Action or Inquiry Finding
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#A6B7A8] mb-1">Action Type</label>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-[#1A241D] border border-[#35473A] text-[#E6EFE5] font-mono"
                    >
                      <option value="NOTE_ADDED">Internal Scrutiny Note</option>
                      <option value="NOTICE_ISSUED">Statutory Notice Issued</option>
                      <option value="HEARING_SCHEDULED">Conciliation / Inquiry Hearing</option>
                      <option value="INSPECTION_ORDERED">Physical Surprise Inspection</option>
                      <option value="COMPLIANCE_RECEIVED">Compliance Proof Received</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#A6B7A8] mb-1">Action Title</label>
                    <input
                      type="text"
                      value={actionTitle}
                      onChange={(e) => setActionTitle(e.target.value)}
                      placeholder="e.g. Scrutiny committee review concluded"
                      className="w-full px-2.5 py-1.5 bg-[#1A241D] border border-[#35473A] text-[#E6EFE5]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#A6B7A8] mb-1">Detailed Remarks / Minutes</label>
                  <textarea
                    rows={2}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder="Enter hearing minutes, notice references, or officer recommendations..."
                    className="w-full px-2.5 py-1.5 bg-[#1A241D] border border-[#35473A] text-[#E6EFE5] font-sans"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowActionForm(false)}
                    className="px-3 py-1 border border-[#35473A] text-[#A6B7A8] hover:text-[#E6EFE5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] font-bold font-mono"
                  >
                    Post to Case Record
                  </button>
                </div>
              </form>
            )}

            {/* Timeline Stream */}
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#35473A]">
              {complaint.timeline.map((item) => (
                <div key={item.id} className="relative group">
                  {/* Timeline Node - Crisp Square Pixel */}
                  <div className="absolute -left-[27px] top-1.5 w-3 h-3 bg-[#1A241D] border-2 border-[#C4F279]" />

                  <div className="p-3.5 bg-[#222F25] border border-[#35473A] group-hover:border-[#4E6654] transition-colors space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase border ${getTimelineBadge(item.actionType)}`}>
                          {item.actionType.replace(/_/g, ' ')}
                        </span>
                        <h4 className="font-bold text-[#E6EFE5] text-xs font-mono">{item.title}</h4>
                      </div>

                      <span className="text-[10px] font-mono text-[#A6B7A8] flex items-center gap-1">
                        <Clock size={11} />
                        {item.timestamp.replace('T', ' ').slice(0, 16)}
                      </span>
                    </div>

                    <p className="text-xs text-[#E6EFE5] leading-relaxed font-sans">
                      {item.remarks}
                    </p>

                    <div className="pt-2 border-t border-[#35473A] flex items-center justify-between text-[10px] font-mono text-[#A6B7A8]">
                      <div>
                        Recorded by: <span className="text-[#E6EFE5]">{item.performedBy}</span> ({item.officerRole})
                      </div>
                      <BureauBadge bureau={item.bureau} size="sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showStatusModal && (
        <StatusUpdateModal
          complaint={complaint}
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
        />
      )}

      {showTransferModal && (
        <TransferBureauModal
          complaint={complaint}
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
        />
      )}

      {showReassignModal && (
        <ReassignOfficerModal
          complaint={complaint}
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
        />
      )}
    </div>
  );
};
