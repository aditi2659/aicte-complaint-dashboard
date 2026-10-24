
import React, { useState } from 'react';
import { OverlapMatch } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { BureauBadge } from '../common/Badge';
import { OverlapCompareModal } from './OverlapCompareModal';
import {
  GitMerge,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Building2,
} from 'lucide-react';

interface OverlapCardProps {
  overlap: OverlapMatch;
}

export const OverlapCard: React.FC<OverlapCardProps> = ({ overlap }) => {
  const { getComplaintById } = useComplaints();
  const [showModal, setShowModal] = useState(false);

  const complaintA = getComplaintById(overlap.complaintAId);
  const complaintB = getComplaintById(overlap.complaintBId);

  if (!complaintA || !complaintB) return null;

  const isConfirmed = overlap.reviewStatus === 'CONFIRMED_RELATED';
  const isDismissed = overlap.reviewStatus === 'DISMISSED';
  const isUnreviewed = overlap.reviewStatus === 'UNREVIEWED';

  const borderColor = isUnreviewed
    ? 'border-[#FF5CAA]/60'
    : isConfirmed
      ? 'border-[#C4F279]/50'
      : 'border-[#303630]';

  const statusColor = isUnreviewed
    ? 'text-[#FF5CAA]'
    : isConfirmed
      ? 'text-[#C4F279]'
      : 'text-[#A6B7A8]';

  const sameInstitution =
    complaintA.aictePermanentId === complaintB.aictePermanentId;

  const detectionReason =
    overlap.reasons?.[0] ||
    'Related complaints detected; further review is required.';

  return (
    <>
      <article
        className={`relative overflow-hidden border bg-[#080A08] p-4 sm:p-5 transition-colors duration-200 ${borderColor}`}
      >
        {/* Small status accent */}
        <div
          className={`absolute right-0 top-0 h-2.5 w-2.5 ${
            isUnreviewed
              ? 'bg-[#FF5CAA]'
              : isConfirmed
                ? 'bg-[#C4F279]'
                : 'bg-[#69766B]'
          }`}
        />

        {/* Header: similarity, Bureau pair and review status */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 font-mono text-xs font-bold ${
                overlap.similarityScore >= 80
                  ? 'text-[#FF5CAA]'
                  : 'text-[#C4F279]'
              }`}
            >
              <GitMerge size={13} />
              {overlap.similarityScore}% Similarity
            </span>

            <span className="flex items-center gap-1.5 font-mono text-xs text-[#A6B7A8]">
              <BureauBadge bureau={complaintA.currentBureau} size="sm" />
              <ArrowRight size={12} className="text-[#69766B]" />
              <BureauBadge bureau={complaintB.currentBureau} size="sm" />
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold ${statusColor}`}
          >
            {isUnreviewed && (
              <>
                <Clock size={12} />
                Unreviewed
              </>
            )}

            {isConfirmed && (
              <>
                <CheckCircle size={12} />
                Confirmed Related
              </>
            )}

            {isDismissed && (
              <>
                <XCircle size={12} />
                Dismissed
              </>
            )}
          </span>
        </div>

        {/* Institution identity */}
        <div className="mb-4 flex items-start gap-2">
          <Building2
            size={16}
            className="mt-0.5 shrink-0 text-[#A6B7A8]"
          />

          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-[#E6EFE5]">
              {complaintA.institutionName}
            </h3>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] font-mono text-[#A6B7A8]">
              <span>Permanent ID: {complaintA.aictePermanentId}</span>

              {sameInstitution && (
                <span className="font-semibold text-[#C4F279]">
                  · Exact ID match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two complaint summaries */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Primary complaint */}
          <section className="border border-[#303630] border-l-2 border-l-[#C4F279] bg-[#111411] p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#C4F279]">
                {complaintA.caseNumber}
              </span>

              <time className="font-mono text-[10px] text-[#849487]">
                {complaintA.registrationDate.split('T')[0]}
              </time>
            </div>

            <h4 className="mb-1 text-xs font-medium leading-relaxed text-[#E6EFE5]">
              {complaintA.subject}
            </h4>

            <p className="text-[11px] leading-relaxed text-[#A6B7A8] line-clamp-2">
              {complaintA.description}
            </p>
          </section>

          {/* Related complaint */}
          <section className="border border-[#303630] border-l-2 border-l-[#FF5CAA] bg-[#101010] p-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#FF5CAA]">
                {complaintB.caseNumber}
              </span>

              <time className="font-mono text-[10px] text-[#849487]">
                {complaintB.registrationDate.split('T')[0]}
              </time>
            </div>

            <h4 className="mb-1 text-xs font-medium leading-relaxed text-[#E6EFE5]">
              {complaintB.subject}
            </h4>

            <p className="text-[11px] leading-relaxed text-[#A6B7A8] line-clamp-2">
              {complaintB.description}
            </p>
          </section>
        </div>

        {/* Detection reason — no extra container */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-wide text-[#FF5CAA]">
            <span className="h-1.5 w-1.5 bg-[#FF5CAA]" />
            Why flagged
          </div>

          <p className="text-[11px] leading-relaxed text-[#D5DFD5]">
            {detectionReason}
          </p>
        </div>

        {/* Review notes, shown only when present */}
        {overlap.reviewNotes && (
          <div className="mb-4 border-l-2 border-l-[#C4F279] pl-3">
            <p className="mb-1 text-[10px] font-mono font-semibold text-[#C4F279]">
              REVIEW NOTE
            </p>
            <p className="text-[11px] leading-relaxed text-[#A6B7A8]">
              {overlap.reviewNotes}
            </p>
          </div>
        )}

        {/* Footer */}
        <footer className="flex flex-col gap-3 border-t border-[#303630] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[10px] text-[#849487]">
            Detected: {overlap.detectedAt.split('T')[0]}
          </span>

          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 bg-[#C4F279] px-3 py-2 text-xs font-semibold font-mono text-[#080A08] transition-colors hover:bg-[#D5FF91]"
          >
            <span>Inspect & Compare</span>
            <ExternalLink size={12} />
          </button>
        </footer>
      </article>

      {showModal && (
        <OverlapCompareModal
          overlap={overlap}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
};
