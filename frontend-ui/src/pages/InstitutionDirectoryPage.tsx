
import React, { useState } from 'react';
import { useComplaints } from '../context/ComplaintContext';
import { InstitutionCard } from '../components/institutions/InstitutionCard';
import { SearchInput } from '../components/common/SearchInput';
import { RotateCcw, Building2 } from 'lucide-react';

export const InstitutionDirectoryPage: React.FC = () => {
  const { institutions } = useComplaints();

  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredInstitutions = institutions.filter(inst => {
    if (search) {
      const q = search.toLowerCase();

      const match =
        inst.name.toLowerCase().includes(q) ||
        inst.aictePermanentId.toLowerCase().includes(q) ||
        inst.state.toLowerCase().includes(q) ||
        inst.directorName.toLowerCase().includes(q);

      if (!match) return false;
    }

    if (regionFilter !== 'ALL' && inst.region !== regionFilter) return false;
    if (typeFilter !== 'ALL' && inst.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && inst.status !== statusFilter) return false;

    return true;
  });

  const hasFilters =
    search !== '' ||
    regionFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const handleReset = () => {
    setSearch('');
    setRegionFilter('ALL');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  const selectClass =
    'w-full min-w-0 px-3 py-2.5 bg-[#090B09] border border-[#303630] text-[#E6EFE5] text-xs font-mono focus:border-[#FF5CAA] focus:outline-none transition-colors';

  const labelClass =
    'block text-[10px] text-[#A6B7A8] uppercase tracking-wider mb-1.5 font-mono';

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-xl font-black text-[#E6EFE5] font-mono tracking-tight">
              Institution Master Directory
            </h2>

            <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-[#C4F279] bg-[#C4F279]/[0.06] border border-[#C4F279]/30">
              {filteredInstitutions.length} Institutions
            </span>
          </div>

          <p className="text-xs text-[#A6B7A8] max-w-3xl leading-relaxed">
            Search technical institutions, monitor cross-Bureau complaint
            activity, and review institutional regulatory standing.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <section className="p-4 bg-[#090B09] border border-[#303630] space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search college name, AICTE Permanent ID, state..."
              className="w-full"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="flex shrink-0 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-mono text-[#A6B7A8] bg-[#111411] border border-[#303630] hover:text-[#FF5CAA] hover:border-[#FF5CAA]/50 transition-colors"
            >
              <RotateCcw size={13} />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#303630]">
          <div>
            <label className={labelClass}>Region</label>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Regions</option>
              <option value="NORTH">Northern</option>
              <option value="SOUTH">Southern</option>
              <option value="EAST">Eastern</option>
              <option value="WEST">Western</option>
              <option value="CENTRAL">Central</option>
              <option value="NORTH_WEST">North Western</option>
              <option value="SOUTH_WEST">South Western</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Institution Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Types</option>
              <option value="PRIVATE_SELF_FINANCED">
                Private / Self-Financed
              </option>
              <option value="GOVERNMENT">
                Government Polytechnic / College
              </option>
              <option value="DEEMED_UNIVERSITY">Deemed University</option>
              <option value="CENTRAL_INSTITUTION">Central Institution</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Regulatory Standing</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={selectClass}
            >
              <option value="ALL">All Standings</option>
              <option value="ACTIVE">Active</option>
              <option value="UNDER_INQUIRY">Under Active Inquiry</option>
              <option value="DEFICIENT_STANDARDS">
                Deficient Standards
              </option>
              <option value="NO_ADMISSION_STATUS">
                Zero Intake / Freeze
              </option>
            </select>
          </div>
        </div>
      </section>

      {/* Results Summary */}
      <div className="flex items-center justify-between gap-3 border-b border-[#303630] pb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#A6B7A8]">
          <Building2 size={14} />
          <span>Institution Records</span>
        </div>

        <span className="text-[11px] font-mono text-[#A6B7A8]">
          Showing{' '}
          <span className="text-[#E6EFE5] font-bold">
            {filteredInstitutions.length}
          </span>{' '}
          of {institutions.length}
        </span>
      </div>

      {/* Institution Cards */}
      {filteredInstitutions.length === 0 ? (
        <div className="py-16 px-4 text-center bg-[#090B09] border border-dashed border-[#303630]">
          <Building2 size={24} className="mx-auto mb-3 text-[#69766B]" />

          <p className="text-sm font-mono text-[#E6EFE5] mb-2">
            No institutions found
          </p>

          <p className="text-xs text-[#A6B7A8] mb-4">
            Try adjusting your search or filters.
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-mono text-[#FF5CAA] border border-[#FF5CAA]/40 hover:bg-[#FF5CAA]/[0.05] transition-colors"
            >
              <RotateCcw size={12} />
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInstitutions.map(inst => (
            <InstitutionCard key={inst.id} institution={inst} />
          ))}
        </div>
      )}
    </div>
  );
};
