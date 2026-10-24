import React from 'react';
import { SearchInput } from '../common/SearchInput';
import { BUREAUS, ASSIGNED_OFFICERS } from '../../data/mockData';
import { RotateCcw } from 'lucide-react';

export interface FilterState {
  search: string;
  bureau: string;
  status: string;
  region: string;
  category: string;
  officerId: string;
  overdueOnly: boolean;
}

interface ComplaintFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
}

export const ComplaintFilters: React.FC<ComplaintFiltersProps> = ({
  filters,
  onChange,
  onReset,
}) => {
  const updateField = (field: keyof FilterState, value: any) => {
    onChange({ ...filters, [field]: value });
  };

  const hasActiveFilters =
    Boolean(filters.search) ||
    filters.bureau !== 'ALL' ||
    filters.status !== 'ALL' ||
    filters.region !== 'ALL' ||
    filters.category !== 'ALL' ||
    filters.officerId !== 'ALL' ||
    filters.overdueOnly;

  const selectClass =
  'w-full min-w-0 border border-[#FF8BCB]/25 bg-[#FF8BCB]/[0.07] px-2.5 py-2 text-xs text-[#F5EAF0] transition-colors hover:border-[#FF8BCB]/45 hover:bg-[#FF8BCB]/[0.10] focus:border-[#FF8BCB]/70 focus:bg-[#FF8BCB]/[0.12] focus:outline-none focus:ring-1 focus:ring-[#FF8BCB]/20';

  const labelClass =
    'mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#A3A3A3]';

  return (
    <div className="space-y-4 border border-[#303530] bg-[#0D0F0D] p-4 sm:p-5">
      {/* Search and quick actions */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={filters.search}
          onChange={(val) => updateField('search', val)}
          placeholder="Filter by case #, institute name, permanent ID, or subject..."
          className="flex-1"
        />

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => updateField('overdueOnly', !filters.overdueOnly)}
            aria-pressed={filters.overdueOnly}
            className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8BCB] ${
              filters.overdueOnly
                ? 'border-[#FF8BCB]/60 bg-[#FF8BCB]/10 text-[#FF8BCB]'
                : 'border-[#353535] bg-[#111311] text-[#B5B5B5] hover:border-[#79405F] hover:text-[#FF8BCB]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 ${
                filters.overdueOnly ? 'bg-[#FF8BCB]' : 'bg-[#777777]'
              }`}
            />
            <span>Overdue Cases Only</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1.5 border border-[#353535] bg-[#111311] px-2.5 py-2.5 font-mono text-xs text-[#A3A3A3] transition-colors hover:border-[#536642] hover:text-[#C4F279] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4F279]"
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span className="hidden md:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown filters */}
      <div className="grid grid-cols-2 gap-3 border-t border-[#292D29] pt-4 text-xs sm:grid-cols-3 lg:grid-cols-5">
        <div className="min-w-0">
          <label className={labelClass}>Bureau</label>
          <select
            value={filters.bureau}
            onChange={(e) => updateField('bureau', e.target.value)}
            className={selectClass}
          >
            <option value="ALL">All Bureaus</option>
            {BUREAUS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.code} ({b.name})
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Status</label>
          <select
            value={filters.status}
            onChange={(e) => updateField('status', e.target.value)}
            className={selectClass}
          >
            <option value="ALL">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_PROCESS">Under Process</option>
            <option value="TRANSFERRED">Transferred</option>
            <option value="ESCALATED">Escalated</option>
            <option value="DISPOSED">Disposed</option>
          </select>
        </div>

        <div className="min-w-0">
          <label className={labelClass}>Region</label>
          <select
            value={filters.region}
            onChange={(e) => updateField('region', e.target.value)}
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

        <div className="min-w-0">
          <label className={labelClass}>Category</label>
          <select
            value={filters.category}
            onChange={(e) => updateField('category', e.target.value)}
            className={selectClass}
          >
            <option value="ALL">All Categories</option>
            <option value="FACULTY_NON_PAYMENT">Faculty Non-Payment</option>
            <option value="EXCESS_CAPITATION_FEE">Capitation Fee</option>
            <option value="INFRASTRUCTURE_DEFICIENCY">Infrastructure</option>
            <option value="UNAPPROVED_COURSES">Unapproved Courses</option>
            <option value="WITHHOLDING_CERTIFICATES">Withholding Degree</option>
            <option value="RAGGING_SAFETY_VIOLATION">Ragging / Safety</option>
            <option value="ADMISSION_IRREGULARITY">Admission Refund</option>
            <option value="GOVERNANCE_MALPRACTICE">Governance Malpractice</option>
          </select>
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <label className={labelClass}>Assigned Officer</label>
          <select
            value={filters.officerId}
            onChange={(e) => updateField('officerId', e.target.value)}
            className={selectClass}
          >
            <option value="ALL">All Officers</option>
            {ASSIGNED_OFFICERS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.bureau})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
