import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { OverlapMatch } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { StatusBadge, BureauBadge, PriorityBadge } from '../common/Badge';
import {
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Building2,
  User,
  Calendar,
  ShieldAlert,
  Info
} from 'lucide-react';

interface OverlapCompareModalProps {
  overlap: OverlapMatch;
  isOpen: boolean;
  onClose: () => void;
}

export const OverlapCompareModal: React.FC<OverlapCompareModalProps> = ({
  overlap,
  isOpen,
  onClose,
}) => {
  const { getComplaintById, reviewOverlap, isOverdue } = useComplaints();

  const complaintA = getComplaintById(overlap.complaintAId);
  const complaintB = getComplaintById(overlap.complaintBId);

  const [reviewNotes, setReviewNotes] = useState(overlap.reviewNotes || '');
  const [relationshipType, setRelationshipType] = useState<OverlapMatch['relationshipType']>(
    overlap.relationshipType || 'FACULTY_STUDENT_CONCURRENT'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  if (!complaintA || !complaintB) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setReviewError(null);
    try {
      await reviewOverlap(overlap.id, 'CONFIRMED_RELATED', reviewNotes || 'Confirmed related case nexus across bureaus.', relationshipType);
      onClose();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to confirm overlap on backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setIsSubmitting(true);
    setReviewError(null);
    try {
      await reviewOverlap(overlap.id, 'DISMISSED', reviewNotes || 'Dismissed upon administrative inspection - unrelated matter.', relationshipType);
      onClose();
    } catch (err: any) {
      setReviewError(err.message || 'Failed to dismiss overlap on backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sameInstitution = complaintA.aictePermanentId === complaintB.aictePermanentId;
  const crossBureau = complaintA.currentBureau !== complaintB.currentBureau;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cross-Bureau Complaint Overlap Inspection & Triaging"
      subtitle={`Flagged Pair: ${complaintA.caseNumber} ↔ ${complaintB.caseNumber} • Similarity: ${overlap.similarityScore}%`}
      maxWidth="5xl"
      accent="pink"
    >
      <div className="space-y-5 text-xs font-sans">
        {/* Top Highlight Summary Banner */}
        <div className="p-3.5 bg-[#FF8BCB]/10 border border-[#FF8BCB]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FF8BCB]/20 border border-[#FF8BCB]/50 flex items-center justify-center text-[#FF8BCB] font-mono font-bold text-sm">
              {overlap.similarityScore}%
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#E6EFE5] text-sm font-mono">Cross-Bureau Nexus Detected</span>
                {sameInstitution && (
                  <span className="px-2 py-0.5 bg-[#C4F279]/15 text-[#C4F279] border border-[#C4F279]/40 text-[10px] font-mono">
                    Same Permanent ID
                  </span>
                )}
                {crossBureau && (
                  <span className="px-2 py-0.5 bg-[#222F25] text-[#A6B7A8] border border-[#35473A] text-[10px] font-mono">
                    Jurisdiction: {complaintA.currentBureau} ↔ {complaintB.currentBureau}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#A6B7A8] mt-0.5">
                Human review required. Cross-referencing links records for joint inquiry without altering statutory case autonomy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 text-xs font-mono font-bold uppercase border ${
              overlap.reviewStatus === 'CONFIRMED_RELATED'
                ? 'bg-[#C4F279]/15 text-[#C4F279] border-[#C4F279]/50'
                : overlap.reviewStatus === 'DISMISSED'
                ? 'bg-[#222F25] text-[#A6B7A8] border-[#35473A]'
                : 'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/50'
            }`}>
              {overlap.reviewStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Match Rationale Pill List */}
        <div className="p-3 bg-[#222F25] border border-[#35473A]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8] font-semibold mb-1.5 flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-[#FF8BCB]" />
            <span>Detection Reasons & Heuristics</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-[#E6EFE5]">
            {overlap.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 bg-[#1A241D] p-2 border border-[#35473A]">
                <span className="text-[#FF8BCB] font-mono font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Side-by-Side Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Case A */}
          <div className="p-4 border border-[#C4F279]/40 bg-[#1A241D] space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#222F25] text-[#C4F279] border-b border-l border-[#C4F279]/40 font-mono font-bold text-[10px]">
              CASE A (Primary)
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <BureauBadge bureau={complaintA.currentBureau} />
                <span className="font-mono font-bold text-sm text-[#C4F279]">{complaintA.caseNumber}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={complaintA.status} isOverdue={isOverdue(complaintA)} />
                <PriorityBadge priority={complaintA.priority} />
              </div>
            </div>

            <div className="pt-2 border-t border-[#35473A] space-y-2 text-[11px]">
              <div className="flex items-start gap-2 text-[#E6EFE5]">
                <Building2 size={14} className="text-[#A6B7A8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[#E6EFE5]">{complaintA.institutionName}</div>
                  <div className="text-[10px] font-mono text-[#A6B7A8]">AICTE PID: {complaintA.aictePermanentId}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[#A6B7A8]">
                <User size={13} className="text-[#A6B7A8] shrink-0" />
                <span>Officer: <span className="text-[#E6EFE5]">{complaintA.assignedOfficer.name}</span></span>
              </div>

              <div className="flex items-center gap-2 text-[#A6B7A8]">
                <Calendar size={13} className="text-[#A6B7A8] shrink-0" />
                <span>Filed: <span className="font-mono text-[#E6EFE5]">{complaintA.registrationDate.split('T')[0]}</span></span>
                <span className="text-[#35473A]">|</span>
                <span>Type: <span className="font-mono text-[#C4F279]">{complaintA.complainantType}</span></span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#35473A]">
              <div className="text-[10px] font-mono uppercase text-[#A6B7A8] mb-1">Subject & Grievance</div>
              <div className="font-semibold text-[#E6EFE5] mb-1.5">{complaintA.subject}</div>
              <p className="text-[#A6B7A8] text-[11px] bg-[#222F25] p-2.5 border border-[#35473A] leading-relaxed max-h-36 overflow-y-auto">
                {complaintA.description}
              </p>
            </div>
          </div>

          {/* Case B */}
          <div className="p-4 border border-[#FF8BCB]/40 bg-[#1A241D] space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-1 bg-[#222F25] text-[#FF8BCB] border-b border-l border-[#FF8BCB]/40 font-mono font-bold text-[10px]">
              CASE B (Potentially Related)
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <BureauBadge bureau={complaintB.currentBureau} />
                <span className="font-mono font-bold text-sm text-[#FF8BCB]">{complaintB.caseNumber}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={complaintB.status} isOverdue={isOverdue(complaintB)} />
                <PriorityBadge priority={complaintB.priority} />
              </div>
            </div>

            <div className="pt-2 border-t border-[#35473A] space-y-2 text-[11px]">
              <div className="flex items-start gap-2 text-[#E6EFE5]">
                <Building2 size={14} className="text-[#A6B7A8] shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-[#E6EFE5]">{complaintB.institutionName}</div>
                  <div className="text-[10px] font-mono text-[#A6B7A8]">AICTE PID: {complaintB.aictePermanentId}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[#A6B7A8]">
                <User size={13} className="text-[#A6B7A8] shrink-0" />
                <span>Officer: <span className="text-[#E6EFE5]">{complaintB.assignedOfficer.name}</span></span>
              </div>

              <div className="flex items-center gap-2 text-[#A6B7A8]">
                <Calendar size={13} className="text-[#A6B7A8] shrink-0" />
                <span>Filed: <span className="font-mono text-[#E6EFE5]">{complaintB.registrationDate.split('T')[0]}</span></span>
                <span className="text-[#35473A]">|</span>
                <span>Type: <span className="font-mono text-[#FF8BCB]">{complaintB.complainantType}</span></span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#35473A]">
              <div className="text-[10px] font-mono uppercase text-[#A6B7A8] mb-1">Subject & Grievance</div>
              <div className="font-semibold text-[#E6EFE5] mb-1.5">{complaintB.subject}</div>
              <p className="text-[#A6B7A8] text-[11px] bg-[#222F25] p-2.5 border border-[#35473A] leading-relaxed max-h-36 overflow-y-auto">
                {complaintB.description}
              </p>
            </div>
          </div>
        </div>

        {/* Existing Review Audit Info */}
        {overlap.reviewedBy && (
          <div className="p-3 bg-[#222F25] border border-[#35473A] text-[11px] text-[#A6B7A8] flex items-start gap-2">
            <Info size={15} className="text-[#A6B7A8] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[#E6EFE5]">
                Previous Review Recorded by {overlap.reviewedBy} on {overlap.reviewedAt ? overlap.reviewedAt.split('T')[0] : 'N/A'}:
              </div>
              <p className="text-[#A6B7A8] italic mt-0.5 font-mono text-[10px]">{overlap.reviewNotes}</p>
            </div>
          </div>
        )}

        {/* Human Review Decision Section */}
        <div className="p-4 bg-[#222F25] border border-[#35473A] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-[#E6EFE5] text-xs font-mono uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft size={14} className="text-[#FF8BCB]" />
              <span>Officer Determination & Reviewer Findings</span>
            </h4>
            <span className="text-[10px] text-[#A6B7A8]">Independent Statutory Dossiers Retained</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#A6B7A8] font-medium mb-1 text-[11px]">
                Nexus Taxonomy / Relationship Classification:
              </label>
              <select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-[#1A241D] border border-[#35473A] text-[#E6EFE5] font-mono text-xs focus:border-[#FF8BCB] focus:outline-none"
              >
                <option value="FACULTY_STUDENT_CONCURRENT">Concurrent Faculty & Student Grievance (Same Root Cause)</option>
                <option value="IDENTICAL_GRIEVANCE">Duplicate Complaint from Multiple Petitioners</option>
                <option value="REGULATORY_INFRA_OVERLAP">Regulatory Norms & Capitation Fee Cross-Violation</option>
                <option value="AFFILIATION_DISPUTE">Affiliation, Trust & Intake Dispute</option>
              </select>
            </div>

            <div>
              <label className="block text-[#A6B7A8] font-medium mb-1 text-[11px]">
                Reviewer Evaluation & Coordination Notes:
              </label>
              <input
                type="text"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Document coordination rationale between bureau inquiry officers..."
                className="w-full px-3 py-1.5 bg-[#1A241D] border border-[#35473A] text-[#E6EFE5] text-xs focus:border-[#FF8BCB] focus:outline-none"
              />
            </div>
          </div>

          {reviewError && (
            <div className="bg-[#2D1B1F] border border-[#FF8BCB] px-3 py-2 text-xs font-mono text-[#FF8BCB] flex items-center justify-between">
              <span>⚠️ Review Action Error: {reviewError}</span>
              <button
                type="button"
                onClick={() => setReviewError(null)}
                className="text-[#A6B7A8] hover:text-[#E6EFE5] text-xs font-mono underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#35473A]">
            <div className="text-[10px] text-[#A6B7A8] flex items-center gap-1">
              <span>Human verification required. Confirming links files for joint scrutiny without auto-merging.</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-[#35473A] bg-[#1A241D] hover:bg-[#202D24] text-[#A6B7A8] hover:text-[#E6EFE5] text-xs font-semibold font-mono transition-colors disabled:opacity-50"
              >
                <XCircle size={14} className="text-[#A6B7A8]" />
                <span>{isSubmitting ? 'Processing...' : 'Dismiss Match'}</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FF8BCB] hover:bg-[#F278BA] text-[#101713] text-xs font-bold font-mono transition-colors shadow-xs disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>{isSubmitting ? 'Connecting...' : 'Confirm Related & Link Files'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
