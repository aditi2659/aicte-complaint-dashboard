import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { BureauBadge, StatusBadge } from '../components/common/Badge';
import { RegisterComplaintModal } from '../components/complaints/RegisterComplaintModal';
import {
  ArrowLeft,
  MapPin,
  GitMerge,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

export const InstitutionProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getInstitutionById, complaints, overlaps, isOverdue } = useComplaints();
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  const institution = getInstitutionById(id || '');

  if (!institution) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-[#E6EFE5]">Institution Not Found</h2>
        <p className="text-sm text-[#A6B7A8]">
          The requested institution identifier <span className="font-mono text-[#C4F279]">{id}</span> was not found in the master directory.
        </p>
        <button
          onClick={() => navigate('/institutions')}
          className="px-4 py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  // Complaints belonging to this institution
  const instComplaints = complaints.filter(c => c.institutionId === institution.id);
  const instComplaintIds = instComplaints.map(c => c.id);

  // Overlaps involving this institution's complaints
  const instOverlaps = overlaps.filter(
    o => instComplaintIds.includes(o.complaintAId) || instComplaintIds.includes(o.complaintBId)
  );

  const activeComplaints = instComplaints.filter(c => c.status !== 'DISPOSED');
  const disposedComplaints = instComplaints.filter(c => c.status === 'DISPOSED');
  const resolutionRate = instComplaints.length > 0
    ? Math.round((disposedComplaints.length / instComplaints.length) * 100)
    : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/institutions')}
          className="flex items-center gap-1.5 text-xs font-mono text-[#A6B7A8] hover:text-[#E6EFE5] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Institution Directory</span>
        </button>

        <div className="text-[11px] font-mono text-[#A6B7A8]">
          Permanent ID: <span className="text-[#E6EFE5] font-bold">{institution.aictePermanentId}</span>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="p-6 border border-[#35473A] bg-[#1A241D] relative overflow-hidden shadow-2xl shadow-black/40 space-y-4">
        <div className="absolute top-0 right-0 w-3 h-3 bg-[#C4F279]" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#35473A]">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase bg-[#222F25] text-[#A6B7A8] border border-[#35473A]">
                {institution.type.replace(/_/g, ' ')}
              </span>
              <span className={`px-2.5 py-0.5 text-[11px] font-mono font-bold uppercase border ${
                institution.status === 'ACTIVE'
                  ? 'bg-[#C4F279]/15 text-[#C4F279] border-[#C4F279]/40'
                  : 'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/50'
              }`}>
                {institution.status.replace(/_/g, ' ')}
              </span>
            </div>

            <h1 className="text-xl font-bold text-[#E6EFE5] tracking-wide">
              {institution.name}
            </h1>
            <p className="text-xs text-[#A6B7A8] mt-1 flex items-center gap-2">
              <MapPin size={13} className="text-[#A6B7A8]" />
              <span>{institution.address}, {institution.state} ({institution.region} Region)</span>
            </p>
          </div>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono transition-all shadow-xs shrink-0"
          >
            <PlusCircle size={15} />
            <span>Lodge Complaint Against Institute</span>
          </button>
        </div>

        {/* Institution Attributes Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Director / Head of Institute</div>
            <div className="font-bold text-[#E6EFE5] mt-0.5">{institution.directorName}</div>
            <div className="text-[10px] text-[#A6B7A8] truncate">{institution.contactEmail}</div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Accreditation Profile</div>
            <div className="font-bold text-[#C4F279] mt-0.5">{institution.accreditation}</div>
            <div className="text-[10px] text-[#A6B7A8]">Approved Intake: {institution.approvedIntake} Seats</div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Contact Telephone</div>
            <div className="font-bold text-[#E6EFE5] mt-0.5">{institution.contactPhone}</div>
            <div className="text-[10px] text-[#A6B7A8]">Institutional Liaison Desk</div>
          </div>
          <div>
            <div className="text-[10px] text-[#A6B7A8] uppercase">Resolution Efficiency</div>
            <div className="font-bold text-[#C4F279] mt-0.5">{resolutionRate}% Resolved</div>
            <div className="text-[10px] text-[#A6B7A8]">{disposedComplaints.length} of {instComplaints.length} cases disposed</div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 border border-[#35473A] bg-[#1A241D] font-mono">
          <div className="text-[10px] text-[#A6B7A8] uppercase">Total Filed Cases</div>
          <div className="text-2xl font-black text-[#E6EFE5] mt-1">{instComplaints.length}</div>
          <div className="text-[10px] text-[#A6B7A8]/70 mt-0.5">Across all bureaus</div>
        </div>

        <div className="p-4 border border-[#E5A93C]/30 bg-[#1A241D] font-mono">
          <div className="text-[10px] text-[#A6B7A8] uppercase">Active / In Process</div>
          <div className="text-2xl font-black text-[#E5A93C] mt-1">{activeComplaints.length}</div>
          <div className="text-[10px] text-[#E5A93C]/80 mt-0.5">Pending disposition</div>
        </div>

        <div className="p-4 border border-[#C4F279]/30 bg-[#1A241D] font-mono">
          <div className="text-[10px] text-[#A6B7A8] uppercase">Disposed / Concluded</div>
          <div className="text-2xl font-black text-[#C4F279] mt-1">{disposedComplaints.length}</div>
          <div className="text-[10px] text-[#C4F279]/80 mt-0.5">Orders executed</div>
        </div>

        <div className="p-4 border border-[#FF8BCB]/30 bg-[#1A241D] font-mono">
          <div className="text-[10px] text-[#A6B7A8] uppercase">Overlap Incidents</div>
          <div className="text-2xl font-black text-[#FF8BCB] mt-1">{instOverlaps.length}</div>
          <div className="text-[10px] text-[#FF8BCB]/80 mt-0.5">Cross-bureau matches</div>
        </div>
      </div>

      {/* Cross-Bureau Complaints History Table */}
      <div className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#35473A]">
          <div>
            <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide flex items-center gap-2">
              <span>Institution Complaint Registry History</span>
              <span className="text-xs font-mono font-bold text-[#C4F279] bg-[#C4F279]/10 px-2 py-0.5 border border-[#C4F279]/40">
                {instComplaints.length} Dossiers
              </span>
            </h3>
            <p className="text-[11px] text-[#A6B7A8]">
              Chronological log of all past and current grievances filed across AICTE bureaus.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#141C16] border-b border-[#35473A] text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                <th className="py-2.5 px-3">Case Number</th>
                <th className="py-2.5 px-3">Category & Subject</th>
                <th className="py-2.5 px-3">Bureau</th>
                <th className="py-2.5 px-3">Assigned Officer</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Date Registered</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26362A] font-sans">
              {instComplaints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#A6B7A8]">
                    No complaints registered for this technical institution.
                  </td>
                </tr>
              ) : (
                instComplaints.map(c => (
                  <tr key={c.id} className="hover:bg-[#222F25] transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#E6EFE5]">
                      <button
                        onClick={() => navigate(`/complaints/${c.id}`)}
                        className="hover:text-[#C4F279] flex items-center gap-1"
                      >
                        <span>{c.caseNumber}</span>
                        <ExternalLink size={11} className="opacity-60" />
                      </button>
                    </td>
                    <td className="py-3 px-3 max-w-[280px]">
                      <div className="font-medium text-[#E6EFE5] line-clamp-1">{c.subject}</div>
                      <div className="text-[10px] text-[#A6B7A8] line-clamp-1">{c.categoryLabel}</div>
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <BureauBadge bureau={c.currentBureau} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-[#E6EFE5]">
                      {c.assignedOfficer.name}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={c.status} isOverdue={isOverdue(c)} size="sm" />
                    </td>
                    <td className="py-3 px-3 font-mono text-[#A6B7A8]">
                      {c.registrationDate.split('T')[0]}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/complaints/${c.id}`)}
                        className="px-2.5 py-1 bg-[#222F25] hover:bg-[#2E3F32] border border-[#35473A] text-[#E6EFE5] text-xs font-mono transition-colors"
                      >
                        Inspect Dossier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institution Overlaps Section */}
      {instOverlaps.length > 0 && (
        <div className="p-5 border border-[#FF8BCB]/40 bg-[#1A241D] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#35473A]">
            <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide flex items-center gap-2">
              <GitMerge size={16} className="text-[#FF8BCB]" />
              <span>Cross-Bureau Overlap Flags Involving this Institution</span>
            </h3>
            <button
              onClick={() => navigate('/overlaps')}
              className="text-xs font-mono text-[#FF8BCB] hover:underline"
            >
              Open in Overlap Center →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instOverlaps.map(ovl => (
              <div key={ovl.id} className="p-3.5 bg-[#222F25] border border-[#35473A] text-xs space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-[#FF8BCB] font-bold">{ovl.similarityScore}% Match Confidence</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#1A241D] text-[#A6B7A8]">{ovl.reviewStatus}</span>
                </div>
                <div className="text-[#E6EFE5] line-clamp-2 text-[11px]">
                  {ovl.reasons[0]}
                </div>
                <div className="text-[10px] font-mono text-[#A6B7A8]">
                  Detected: {ovl.detectedAt.split('T')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register Complaint Modal pre-filled */}
      {showRegisterModal && (
        <RegisterComplaintModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
          defaultInstitutionId={institution.id}
        />
      )}
    </div>
  );
};
