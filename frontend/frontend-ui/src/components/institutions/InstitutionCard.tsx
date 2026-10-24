
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Institution } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import {
  MapPin,
  Award,
  ArrowRight,
  GitMerge,
} from 'lucide-react';

interface InstitutionCardProps {
  institution: Institution;
}

export const InstitutionCard: React.FC<InstitutionCardProps> = ({
  institution,
}) => {
  const navigate = useNavigate();
  const { complaints, overlaps } = useComplaints();

  const instComplaints = complaints.filter(
    c => c.institutionId === institution.id
  );

  const instComplaintIds = instComplaints.map(c => c.id);

  const hasActiveOverlap = overlaps.some(
    o =>
      o.reviewStatus === 'UNREVIEWED' &&
      (instComplaintIds.includes(o.complaintAId) ||
        instComplaintIds.includes(o.complaintBId))
  );

  const statusBadge = {
    text: institution.status.replace(/_/g, ' '),
    style:
      'bg-[#C4F279]/[0.06] text-[#C4F279] border-[#C4F279]/30',
  };

  if (institution.status === 'UNDER_INQUIRY') {
    statusBadge.text = 'Under Active Inquiry';
    statusBadge.style =
      'bg-[#FF5CAA]/[0.07] text-[#FF5CAA] border-[#FF5CAA]/40';
  } else if (institution.status === 'DEFICIENT_STANDARDS') {
    statusBadge.text = 'Deficient Standards';
    statusBadge.style =
      'bg-[#E5A93C]/[0.07] text-[#E5A93C] border-[#E5A93C]/35';
  } else if (institution.status === 'NO_ADMISSION_STATUS') {
    statusBadge.text = 'Zero Intake / Freeze';
    statusBadge.style =
      'bg-[#FF5C5C]/[0.07] text-[#FF7777] border-[#FF5C5C]/35';
  }

  const totalCases = instComplaints.length;
  const activeCases = instComplaints.filter(
    c => c.status !== 'DISPOSED'
  ).length;
  const disposedCases = instComplaints.filter(
    c => c.status === 'DISPOSED'
  ).length;

  return (
    <article
      onClick={() => navigate(`/institutions/${institution.id}`)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/institutions/${institution.id}`);
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`View details for ${institution.name}`}
      className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden border bg-[#0D110E] p-4 transition-colors duration-200 hover:bg-[#0D100D] ${
        hasActiveOverlap
          ? 'border-[#FF5CAA]/50 hover:border-[#FF5CAA]/75'
          : 'border-[#303630] hover:border-[#59645A]'
      }`}
    >
      {/* Small status accent */}
      <div
        className={`absolute right-0 top-0 h-2.5 w-2.5 ${
          hasActiveOverlap
            ? 'bg-[#FF5CAA]'
            : institution.status === 'ACTIVE'
              ? 'bg-[#C4F279]'
              : 'bg-[#69766B]'
        }`}
      />

      <div>
        {/* Status and overlap alert */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`border px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wide ${statusBadge.style}`}
          >
            {statusBadge.text}
          </span>

          {hasActiveOverlap && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#FF5CAA]">
              <GitMerge size={11} />
              Overlap Alert
            </span>
          )}
        </div>

        {/* Institution name */}
        <h3 className="mb-1 line-clamp-2 text-sm font-bold leading-relaxed text-[#E6EFE5] transition-colors group-hover:text-[#C4F279]">
          {institution.name}
        </h3>

        {/* Permanent ID */}
        <p className="mb-4 text-[10px] font-mono text-[#849487]">
          AICTE PID:{' '}
          <span className="font-semibold text-[#D5DFD5]">
            {institution.aictePermanentId}
          </span>
        </p>

        {/* Location and accreditation */}
        <div className="mb-4 space-y-2 text-[11px] text-[#A6B7A8]">
          <div className="flex items-center gap-2">
            <MapPin size={13} className="shrink-0 text-[#849487]" />
            <span className="line-clamp-1">
              {institution.state} ({institution.region.replace(/_/g, ' ')} Region)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Award size={13} className="shrink-0 text-[#849487]" />
            <span className="line-clamp-1">
              {institution.accreditation}
            </span>
          </div>
        </div>
      </div>

      {/* Complaint statistics */}
      <div className="border-t border-[#303630] pt-3">
        <div className="grid grid-cols-3 gap-3 font-mono">
          <div className="min-w-0">
            <div className="text-lg font-bold text-[#E6EFE5]">
              {totalCases}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-[#849487]">
              Total Cases
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-lg font-bold text-[#FF5CAA]">
              {activeCases}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-[#849487]">
              Active
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-lg font-bold text-[#C4F279]">
              {disposedCases}
            </div>
            <div className="text-[9px] uppercase tracking-wide text-[#849487]">
              Disposed
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#252B26] pt-3">
          <span className="text-[10px] font-mono text-[#849487]">
            Intake: {institution.approvedIntake.toLocaleString('en-IN')}
          </span>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[#C4F279] transition-colors group-hover:text-[#FF5CAA]">
            View History
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </div>
      </div>
    </article>
  );
};
