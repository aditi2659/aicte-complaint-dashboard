import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { ComplaintFilters, FilterState } from '../components/complaints/ComplaintFilters';
import { ComplaintTable } from '../components/complaints/ComplaintTable';
import { RegisterComplaintModal } from '../components/complaints/RegisterComplaintModal';
import { PlusCircle, Download } from 'lucide-react';

export const ComplaintRegistryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { complaints, isOverdue } = useComplaints();
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Initialize filter state from URL query parameters
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    bureau: searchParams.get('bureau') || 'ALL',
    status: searchParams.get('status') || 'ALL',
    region: searchParams.get('region') || 'ALL',
    category: searchParams.get('category') || 'ALL',
    officerId: searchParams.get('officerId') || 'ALL',
    overdueOnly: searchParams.get('overdue') === 'true',
  });

  // Keep filters in sync when URL search params change
  useEffect(() => {
    const urlBureau = searchParams.get('bureau');
    const urlStatus = searchParams.get('status');
    const urlOverdue = searchParams.get('overdue');
    const urlSearch = searchParams.get('search');

    setFilters(prev => ({
      ...prev,
      bureau: urlBureau || prev.bureau,
      status: urlStatus || prev.status,
      overdueOnly: urlOverdue === 'true' ? true : prev.overdueOnly,
      search: urlSearch !== null ? urlSearch : prev.search,
    }));
  }, [searchParams]);

  const handleResetFilters = () => {
    const emptyFilters: FilterState = {
      search: '',
      bureau: 'ALL',
      status: 'ALL',
      region: 'ALL',
      category: 'ALL',
      officerId: 'ALL',
      overdueOnly: false,
    };
    setFilters(emptyFilters);
    setSearchParams({});
  };

  // Filter complaints based on criteria
  const filteredComplaints = complaints.filter(c => {
    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        c.caseNumber.toLowerCase().includes(q) ||
        c.institutionName.toLowerCase().includes(q) ||
        c.aictePermanentId.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.assignedOfficer.name.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Bureau
    if (filters.bureau !== 'ALL' && c.currentBureau !== filters.bureau) {
      return false;
    }

    // Status
    if (filters.status !== 'ALL' && c.status !== filters.status) {
      return false;
    }

    // Region
    if (filters.region !== 'ALL' && c.region !== filters.region) {
      return false;
    }

    // Category
    if (filters.category !== 'ALL' && c.category !== filters.category) {
      return false;
    }

    // Officer
    if (filters.officerId !== 'ALL' && c.assignedOfficer.id !== filters.officerId) {
      return false;
    }

    // Overdue Only
    if (filters.overdueOnly && !isOverdue(c)) {
      return false;
    }

    return true;
  });

  const handleExportCSV = () => {
    const headers = ['Case Number', 'Institution', 'Permanent ID', 'Bureau', 'Officer', 'Status', 'Registration Date', 'Due Date', 'Category'];
    const rows = filteredComplaints.map(c => [
      c.caseNumber,
      `"${c.institutionName}"`,
      c.aictePermanentId,
      c.currentBureau,
      `"${c.assignedOfficer.name}"`,
      c.status,
      c.registrationDate.split('T')[0],
      c.dueDate.split('T')[0],
      `"${c.categoryLabel}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AICTE_Complaint_Registry_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#E6EFE5] font-mono tracking-tight flex items-center gap-2">
            <span>National Complaint Registry</span>
            <span className="text-xs font-mono font-bold text-[#C4F279] bg-[#C4F279]/10 px-2 py-0.5 border border-[#C4F279]/40">
              {filteredComplaints.length} Records
            </span>
          </h2>
          <p className="text-xs text-[#A3A3A3]">
            Multi-bureau regulatory repository with multi-axis filtering, assignment monitoring, and case handover workflows.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-[#FF69B4]/70 bg-[#FF69B4]/15 px-4 py-2 font-mono text-xs font-bold text-[#FF8BCB] transition-all duration-200 hover:border-[#C4F279] hover:bg-[#C4F279]/25 hover:shadow-[0_0_12px_rgba(196,242,121,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4F279]"
            title="Export filtered records to CSV format"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 border border-[#FF69B4]/70 bg-[#FF69B4]/15 px-4 py-2 font-mono text-xs font-bold text-[#FF8BCB] transition-all duration-200 hover:border-[#C4F279] hover:bg-[#C4F279]/25 hover:shadow-[0_0_12px_rgba(196,242,121,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4F279]"
          >
            <PlusCircle size={15} />
            <span>Register Complaint</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <ComplaintFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />

      {/* Complaint Data Table */}
      <ComplaintTable complaints={filteredComplaints} />

      {/* Register Complaint Modal */}
      {showRegisterModal && (
        <RegisterComplaintModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
    </div>
  );
};
