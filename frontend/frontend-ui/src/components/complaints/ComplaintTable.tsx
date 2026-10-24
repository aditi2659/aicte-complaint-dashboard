import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Complaint } from '../../types';
import { useComplaints } from '../../context/ComplaintContext';
import { StatusBadge, BureauBadge } from '../common/Badge';
import { StatusUpdateModal } from './StatusUpdateModal';
import { TransferBureauModal } from './TransferBureauModal';
import { ReassignOfficerModal } from './ReassignOfficerModal';
import { 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  GitMerge, 
  Edit,
  ArrowRightLeft,
  UserCheck
} from 'lucide-react';

interface ComplaintTableProps {
  complaints: Complaint[];
}

export const ComplaintTable: React.FC<ComplaintTableProps> = ({ complaints }) => {
  const navigate = useNavigate();
  const { isOverdue, getDaysRemainingOrOverdue } = useComplaints();

  // Sorting state
  const [sortField, setSortField] = useState<keyof Complaint>('registrationDate');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Active Modals
  const [selectedForStatus, setSelectedForStatus] = useState<Complaint | null>(null);
  const [selectedForTransfer, setSelectedForTransfer] = useState<Complaint | null>(null);
  const [selectedForReassign, setSelectedForReassign] = useState<Complaint | null>(null);

  // Sorting logic
  const sortedComplaints = [...complaints].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'registrationDate' || sortField === 'dueDate' || sortField === 'lastActionDate') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedComplaints.length / pageSize) || 1;
  const paginatedComplaints = sortedComplaints.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: keyof Complaint) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden border border-[#3D4A38] bg-[#0B0D0B] shadow-xl shadow-black/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-b-[#C4F279] bg-[#C4F279]/[0.08] text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffffff] shadow-[0_3px_12px_rgba(196,242,121,0.12)]">
                <th className="py-3 px-4 cursor-pointer hover:text-[#E6EFE5]" onClick={() => handleSort('caseNumber')}>
                  <div className="flex items-center gap-1.5">
                    <span>Case Number</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-[#E6EFE5]" onClick={() => handleSort('institutionName')}>
                  <div className="flex items-center gap-1.5">
                    <span>Institution & ID</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4">Subject & Category</th>
                <th className="py-3 px-4 cursor-pointer hover:text-[#E6EFE5]" onClick={() => handleSort('currentBureau')}>
                  <div className="flex items-center gap-1.5">
                    <span>Bureau</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4">Assigned Officer</th>
                <th className="py-3 px-4 cursor-pointer hover:text-[#E6EFE5]" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">
                    <span>Status</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-[#E6EFE5]" onClick={() => handleSort('dueDate')}>
                  <div className="flex items-center gap-1.5">
                    <span>SLA / Due Date</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#242824] font-sans">
              {paginatedComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#A6B7A8]">
                    No complaints match the specified filters. Try adjusting search or clearing criteria.
                  </td>
                </tr>
              ) : (
                paginatedComplaints.map((c, rowIndex) => {
                  const overdue = isOverdue(c);
                  const { days } = getDaysRemainingOrOverdue(c);

                  return (
                    <tr 
                      key={c.id} 
                      className={`transition-colors duration-150 ${
                        overdue
                          ? 'bg-[#FF8BCB]/[0.045] hover:bg-[#FF8BCB]/[0.09]'
                          : rowIndex % 2 === 0
                            ? 'bg-[#0D0F0D] hover:bg-[#151915]'
                            : 'bg-[#101210] hover:bg-[#181D18]'
                      }`}
                    >
                      {/* Case Number */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate(`/complaints/${c.id}`)}
                            className="font-bold text-[#E6EFE5] hover:text-[#C4F279] transition-colors flex items-center gap-1 text-xs"
                          >
                            <span>{c.caseNumber}</span>
                            <ExternalLink size={11} className="opacity-60" />
                          </button>
                        </div>

                        {c.hasActiveOverlap && (
                          <div 
                            onClick={() => navigate('/overlaps')}
                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FF8BCB]/15 text-[#FF8BCB] border border-[#FF8BCB]/50 text-[10px] cursor-pointer hover:bg-[#FF8BCB]/25"
                          >
                            <GitMerge size={10} />
                            <span>Overlap Flag</span>
                          </div>
                        )}
                      </td>

                      {/* Institution */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <button
                          onClick={() => navigate(`/institutions/${c.institutionId}`)}
                          className="font-semibold text-[#E6EFE5] hover:text-[#C4F279] text-left line-clamp-1 block transition-colors"
                          title={c.institutionName}
                        >
                          {c.institutionName}
                        </button>
                        <div className="text-[10px] font-mono text-[#A6B7A8] flex items-center gap-1.5 mt-0.5">
                          <span>{c.aictePermanentId}</span>
                          <span>•</span>
                          <span className="text-[#A6B7A8]">{c.region}</span>
                        </div>
                      </td>

                      {/* Subject & Category */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-medium text-[#E6EFE5] line-clamp-1" title={c.subject}>
                          {c.subject}
                        </div>
                        <div className="text-[11px] text-[#A6B7A8] line-clamp-1 mt-0.5">
                          {c.categoryLabel}
                        </div>
                      </td>

                      {/* Bureau */}
                      <td className="py-3.5 px-4 font-mono">
                        <BureauBadge bureau={c.currentBureau} size="sm" />
                      </td>

                      {/* Assigned Officer */}
                      <td className="py-3.5 px-4">
                        <div className="text-[#E6EFE5] font-medium whitespace-nowrap">
                          {c.assignedOfficer.name}
                        </div>
                        <div className="text-[10px] font-mono text-[#A6B7A8]">
                          {c.assignedOfficer.designation}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={c.status} isOverdue={overdue} size="sm" />
                      </td>

                      {/* SLA Due Date */}
                      <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                        <div className="text-[#E6EFE5] text-xs">
                          {c.dueDate.split('T')[0]}
                        </div>
                        {c.status !== 'DISPOSED' && (
                          <div className={`text-[10px] font-bold ${
                            overdue ? 'text-[#FF8BCB]' : 'text-[#A6B7A8]'
                          }`}>
                            {overdue ? `${days}d Overdue` : `${days}d left`}
                          </div>
                        )}
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedForStatus(c)}
                            title="Update Status"
                            className="border border-[#353935] bg-[#141614] p-1.5 text-[#A3A3A3] transition-colors hover:border-[#657B4B] hover:bg-[#C4F279]/[0.08] hover:text-[#C4F279] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C4F279]"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            onClick={() => setSelectedForTransfer(c)}
                            title="Transfer Bureau"
                            className="border border-[#353535] bg-[#141414] p-1.5 text-[#A3A3A3] transition-colors hover:border-[#79405F] hover:bg-[#FF8BCB]/[0.08] hover:text-[#FF8BCB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF8BCB]"
                          >
                            <ArrowRightLeft size={13} />
                          </button>
                          <button
                            onClick={() => setSelectedForReassign(c)}
                            title="Reassign Officer"
                            className="border border-[#353935] bg-[#141614] p-1.5 text-[#A3A3A3] transition-colors hover:border-[#657B4B] hover:bg-[#C4F279]/[0.08] hover:text-[#C4F279] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C4F279]"
                          >
                            <UserCheck size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-[#303530] bg-[#101210] px-4 py-3 text-xs font-mono text-[#A3A3A3] sm:flex-row">
          <div>
            Showing <span className="text-[#E6EFE5] font-bold">{Math.min(complaints.length, (currentPage - 1) * pageSize + 1)}</span> to{' '}
            <span className="text-[#E6EFE5] font-bold">{Math.min(complaints.length, currentPage * pageSize)}</span> of{' '}
            <span className="text-[#E6EFE5] font-bold">{complaints.length}</span> recorded complaints
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border border-[#353535] bg-[#151715] p-1.5 text-[#A3A3A3] transition-colors hover:border-[#536642] hover:bg-[#1C2119] hover:text-[#C4F279] disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span>
              Page <span className="text-[#E6EFE5] font-bold">{currentPage}</span> of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border border-[#353535] bg-[#151715] p-1.5 text-[#A3A3A3] transition-colors hover:border-[#536642] hover:bg-[#1C2119] hover:text-[#C4F279] disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modals */}
      {selectedForStatus && (
        <StatusUpdateModal
          complaint={selectedForStatus}
          isOpen={Boolean(selectedForStatus)}
          onClose={() => setSelectedForStatus(null)}
        />
      )}

      {selectedForTransfer && (
        <TransferBureauModal
          complaint={selectedForTransfer}
          isOpen={Boolean(selectedForTransfer)}
          onClose={() => setSelectedForTransfer(null)}
        />
      )}

      {selectedForReassign && (
        <ReassignOfficerModal
          complaint={selectedForReassign}
          isOpen={Boolean(selectedForReassign)}
          onClose={() => setSelectedForReassign(null)}
        />
      )}
    </>
  );
};
