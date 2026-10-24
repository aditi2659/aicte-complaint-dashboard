
import React, { useMemo, useState } from 'react';
import { useComplaints } from '../context/ComplaintContext';
import { OverlapCard } from '../components/overlap/OverlapCard';
import { OverlapReviewStatus, BureauCode } from '../types';
import { ComplaintNetwork } from '../components/overlap/ComplaintNetwork';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

type StatusFilter = OverlapReviewStatus | 'ALL';
type BureauFilter = BureauCode | 'CROSS_BUREAU' | 'ALL';

const BUREAU_OPTIONS: { value: BureauFilter; label: string }[] = [
  { value: 'ALL', label: 'All Bureaus' },
  { value: 'CROSS_BUREAU', label: 'Cross-Bureau Matches' },
  { value: 'RB', label: 'Regulation Bureau (RB)' },
  { value: 'PGRC', label: 'Public Grievance Redressal Cell (PGRC)' },
  { value: 'AB', label: 'Approval Bureau (AB)' },
  { value: 'PAPB', label: 'Policy & Academic Planning Bureau (PAPB)' },
  { value: 'FDB', label: 'Faculty Development Bureau (FDB)' },
  { value: 'SDC', label: 'Skill Development Cell (SDC)' },
];

export const OverlapCenterPage: React.FC = () => {
  const { overlaps, getComplaintById } = useComplaints();

  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBureau, setFilterBureau] = useState<BureauFilter>('ALL');

  const unreviewedCount = overlaps.filter(
    o => o.reviewStatus === 'UNREVIEWED'
  ).length;

  const confirmedCount = overlaps.filter(
    o => o.reviewStatus === 'CONFIRMED_RELATED'
  ).length;

  const dismissedCount = overlaps.filter(
    o => o.reviewStatus === 'DISMISSED'
  ).length;

  const filteredOverlaps = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return overlaps.filter(overlap => {
      // 1. Review-status filter
      if (
        filterStatus !== 'ALL' &&
        overlap.reviewStatus !== filterStatus
      ) {
        return false;
      }

      // Resolve the two complaints associated with this overlap.
      const complaintA = getComplaintById(overlap.complaintAId);
      const complaintB = getComplaintById(overlap.complaintBId);

      // 2. Bureau filter
      if (filterBureau !== 'ALL') {
        if (!complaintA || !complaintB) return false;

        if (filterBureau === 'CROSS_BUREAU') {
          if (complaintA.currentBureau === complaintB.currentBureau) {
            return false;
          }
        } else {
          const involvesSelectedBureau =
            complaintA.currentBureau === filterBureau ||
            complaintB.currentBureau === filterBureau;

          if (!involvesSelectedBureau) return false;
        }
      }

      // 3. Search across both complaints and overlap metadata.
      if (!query) return true;

      const searchableFields = [
        overlap.id,
        overlap.complaintAId,
        overlap.complaintBId,
        overlap.similarityScore,
        overlap.reviewStatus,
        overlap.detectedAt,
        overlap.relationshipType,
        ...(overlap.reasons ?? []),
        ...(overlap.matchingCategories ?? []),
        overlap.reviewNotes,
        complaintA?.id,
        complaintA?.caseNumber,
        complaintA?.institutionId,
        complaintA?.institutionName,
        complaintA?.aictePermanentId,
        complaintA?.subject,
        complaintA?.description,
        complaintA?.category,
        complaintA?.categoryLabel,
        complaintA?.currentBureau,
        complaintA?.region,
        complaintA?.state,
        complaintA?.status,
        complaintA?.assignedOfficer?.name,
        complaintB?.id,
        complaintB?.caseNumber,
        complaintB?.institutionId,
        complaintB?.institutionName,
        complaintB?.aictePermanentId,
        complaintB?.subject,
        complaintB?.description,
        complaintB?.category,
        complaintB?.categoryLabel,
        complaintB?.currentBureau,
        complaintB?.region,
        complaintB?.state,
        complaintB?.status,
        complaintB?.assignedOfficer?.name,
      ];

      return searchableFields.some(
        field =>
          field !== undefined &&
          field !== null &&
          String(field).toLowerCase().includes(query)
      );
    });
  }, [
    overlaps,
    getComplaintById,
    filterStatus,
    filterBureau,
    searchQuery,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterStatus !== 'ALL' ||
    filterBureau !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('ALL');
    setFilterBureau('ALL');
  };

  const statusButtonClass = (active: boolean, color: string) =>
    `px-3 py-2 border transition-all flex items-center gap-1.5 text-xs font-mono whitespace-nowrap ${
      active
        ? `${color} font-bold`
        : 'bg-[#1A241D] text-[#A6B7A8] border-[#35473A] hover:text-[#E6EFE5] hover:border-[#4E6654]'
    }`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h2 className="text-xl font-black text-[#E6EFE5] font-mono tracking-tight">
              Cross-Bureau Overlap Detection Centre
            </h2>
            <span className="px-2 py-0.5 bg-[#FF8BCB]/15 text-[#FF8BCB] border border-[#FF8BCB]/50 text-[10px] font-mono font-bold uppercase">
              Key Differentiator
            </span>
          </div>

          <p className="text-xs text-[#A6B7A8] max-w-2xl">
            Detects concurrent grievances, identical root causes, and duplicate
            petitions spanning the Regulation Bureau (RB), Public Grievance
            Redressal Cell (PGRC), Approval Bureau (AB), and other Bureaus/Cells.
          </p>
        </div>

        {/* Prototype Safeguard Disclaimer */}
        <div className="px-3 py-2 bg-[#1A241D] border border-[#35473A] text-[11px] font-mono text-[#A6B7A8] flex items-center gap-2 shrink-0">
          <ShieldCheck size={14} className="text-[#C4F279] shrink-0" />
          <span>Human-in-the-Loop Triaging • No Auto-Merges</span>
        </div>
      </div>

      {/* Network Visualization */}
      <div className="p-4 border border-[#35473A] bg-[#1A241D] flex items-start gap-3 text-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-2 h-2 bg-[#FF8BCB]" />
        <Sparkles size={18} className="text-[#FF8BCB] shrink-0 mt-0.5" />
        <ComplaintNetwork overlaps={overlaps} />
      </div>

      {/* Search and Bureau Filters */}
      <section className="p-4 border border-[#35473A] bg-[#1A241D] space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[#C4F279]" />
            <h3 className="text-sm font-bold font-mono text-[#E6EFE5]">
              Find Overlaps
            </h3>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-[11px] font-mono text-[#FF8BCB] hover:text-[#E6EFE5] transition-colors"
            >
              <RotateCcw size={12} />
              Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(230px,0.65fr)] gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7C9C82] pointer-events-none"
            />

            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search case ID, institution, Permanent ID, complaint text..."
              aria-label="Search overlap records"
              className="w-full h-11 pl-9 pr-3 bg-[#080C09] border border-[#35473A] text-[#E6EFE5] text-xs font-mono placeholder:text-[#7C9C82] focus:outline-none focus:border-[#C4F279] focus:ring-1 focus:ring-[#C4F279]/20 transition-colors"
            />
          </div>

          {/* Bureau Filter */}
          <div className="relative">
            <select
              value={filterBureau}
              onChange={event =>
                setFilterBureau(event.target.value as BureauFilter)
              }
              aria-label="Filter overlaps by Bureau"
              className="appearance-none w-full h-11 pl-3 pr-9 bg-[#080C09] border border-[#35473A] text-[#E6EFE5] text-xs font-mono focus:outline-none focus:border-[#C4F279] focus:ring-1 focus:ring-[#C4F279]/20 transition-colors cursor-pointer"
            >
              {BUREAU_OPTIONS.map(option => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-[#1A241D] text-[#E6EFE5]"
                >
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7C9C82] pointer-events-none"
            />
          </div>
        </div>

        <p className="text-[10px] text-[#7C9C82] font-mono">
          Search both linked complaints by case number, institution, Permanent
          ID, subject, description, assigned officer, or detection reason.
        </p>
      </section>

      {/* Status Filter Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-[#35473A]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            aria-pressed={filterStatus === 'ALL'}
            className={statusButtonClass(
              filterStatus === 'ALL',
              'bg-[#222F25] text-[#E6EFE5] border-[#4E6654]'
            )}
          >
            All Overlaps ({overlaps.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('UNREVIEWED')}
            aria-pressed={filterStatus === 'UNREVIEWED'}
            className={statusButtonClass(
              filterStatus === 'UNREVIEWED',
              'bg-[#FF8BCB]/15 text-[#FF8BCB] border-[#FF8BCB]/60'
            )}
          >
            <Clock size={12} />
            <span>Unreviewed ({unreviewedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('CONFIRMED_RELATED')}
            aria-pressed={filterStatus === 'CONFIRMED_RELATED'}
            className={statusButtonClass(
              filterStatus === 'CONFIRMED_RELATED',
              'bg-[#C4F279]/15 text-[#C4F279] border-[#C4F279]/50'
            )}
          >
            <CheckCircle size={12} />
            <span>Confirmed Related ({confirmedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DISMISSED')}
            aria-pressed={filterStatus === 'DISMISSED'}
            className={statusButtonClass(
              filterStatus === 'DISMISSED',
              'bg-[#222F25] text-[#E6EFE5] border-[#4E6654]'
            )}
          >
            <XCircle size={12} />
            <span>Dismissed ({dismissedCount})</span>
          </button>
        </div>

        <div
          className="text-[11px] text-[#A6B7A8] font-mono"
          aria-live="polite"
        >
          Showing{' '}
          <span className="text-[#E6EFE5] font-bold">
            {filteredOverlaps.length}
          </span>{' '}
          of {overlaps.length} overlap matches
        </div>
      </div>

      {/* Overlap Cards */}
      <div className="space-y-4">
        {filteredOverlaps.length === 0 ? (
          <div className="p-10 md:p-12 text-center border border-[#35473A] bg-[#1A241D]/70">
            <Search size={24} className="text-[#7C9C82] mx-auto mb-3" />

            <h3 className="text-sm font-bold font-mono text-[#E6EFE5] mb-2">
              No matching overlaps found
            </h3>

            <p className="text-xs text-[#A6B7A8] max-w-md mx-auto mb-4">
              {hasActiveFilters
                ? 'Try a different search term or adjust the Bureau and review-status filters.'
                : 'No overlap records are currently available.'}
            </p>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-3 py-2 border border-[#4E6654] bg-[#222F25] text-[#C4F279] hover:bg-[#2E3F32] text-xs font-mono transition-colors"
              >
                <RotateCcw size={12} />
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredOverlaps.map(overlap => (
            <OverlapCard key={overlap.id} overlap={overlap} />
          ))
        )}
      </div>
    </div>
  );
};
