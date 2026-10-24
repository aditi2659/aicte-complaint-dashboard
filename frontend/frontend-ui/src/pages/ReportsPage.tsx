import React, { useId, useState } from 'react';
import { useComplaints } from '../context/ComplaintContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Download, Clock, TrendingUp } from 'lucide-react';
import { BUREAUS } from '../data/mockData';

type DotMatrixBarProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  orientation?: 'vertical' | 'horizontal';
};

const DOT = 3.5;
const GAP = 9;

const DotMatrixBar: React.FC<DotMatrixBarProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  fill = '#C4F279',
  orientation = 'vertical',
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const patternId = `dm-pattern-${uid}`;
  const clipId = `dm-clip-${uid}`;

  // Recharts can hand us negative / NaN values
  const w = Math.abs(Number(width)) || 0;
  const h = Math.abs(Number(height)) || 0;
  if (w <= 0 || h <= 0 || Number.isNaN(x) || Number.isNaN(y)) return null;

  const left = x;
  const top = height < 0 ? y + height : y;

  // Anchor the dot grid to the bar's base so rows are never cut off there:
  // vertical bars grow upward -> anchor to bottom edge
  // horizontal bars grow rightward -> anchor to left edge
  const patternX = left;
  const patternY = orientation === 'vertical' ? top + h : top;
  const dotX = 1;
  const dotY = orientation === 'vertical' ? GAP - DOT - 1 : 1;

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={left} y={top} width={w} height={h} />
        </clipPath>
        {/* Pattern contents are in tile-local coordinates (0..GAP) */}
        <pattern
          id={patternId}
          x={patternX}
          y={patternY}
          width={GAP}
          height={GAP}
          patternUnits="userSpaceOnUse"
        >
          <rect x={dotX} y={dotY} width={DOT} height={DOT} rx={0.4} fill={fill} />
        </pattern>
      </defs>

      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        {/* faint base so tiny bars are still visible */}
        <rect x={left} y={top} width={w} height={h} fill={fill} opacity={0.08} />
        <rect x={left} y={top} width={w} height={h} fill={`url(#${patternId})`} />
      </g>
    </g>
  );
};

export const ReportsPage: React.FC = () => {
  const { complaints, isOverdue } = useComplaints();
  const [selectedReportTimeframe, setSelectedReportTimeframe] = useState<
    'Q3_2026' | 'YTD_2026' | 'ALL_TIME'
  >('Q3_2026');

  // Compute Region Breakdown
  const regionCounts: Record<string, number> = {};
  complaints.forEach((c) => {
    regionCounts[c.region] = (regionCounts[c.region] || 0) + 1;
  });

  const regionData = Object.keys(regionCounts).map((r) => ({
    region: r.replace(/_/g, ' '),
    complaints: regionCounts[r],
  }));

  // Ageing Breakdown (< 15 days, 15-30 days, 30-60 days, > 60 days)
  const now = new Date().getTime();
  let ageUnder15 = 0;
  let age15to30 = 0;
  let age30to60 = 0;
  let ageOver60 = 0;

  complaints
    .filter((c) => c.status !== 'DISPOSED')
    .forEach((c) => {
      const regTime = new Date(c.registrationDate).getTime();
      const ageDays = (now - regTime) / (1000 * 60 * 60 * 24);
      if (ageDays < 15) ageUnder15++;
      else if (ageDays <= 30) age15to30++;
      else if (ageDays <= 60) age30to60++;
      else ageOver60++;
    });

  const ageingData = [
    { bracket: '< 15 Days', count: ageUnder15, fill: '#C4F279' },
    { bracket: '15 - 30 Days', count: age15to30, fill: '#A4D857' },
    { bracket: '30 - 60 Days', count: age30to60, fill: '#E5A93C' },
    { bracket: '> 60 Days', count: ageOver60, fill: '#FF8BCB' },
  ];

  // Bureau Performance Matrix
  const bureauPerformance = BUREAUS.map((b) => {
    const bComplaints = complaints.filter((c) => c.currentBureau === b.code);
    const total = bComplaints.length;
    const disposed = bComplaints.filter((c) => c.status === 'DISPOSED').length;
    const active = total - disposed;
    const overdue = bComplaints.filter((c) => isOverdue(c)).length;
    const rate = total > 0 ? Math.round((disposed / total) * 100) : 100;

    return {
      code: b.code,
      name: b.name,
      head: b.headOfficer,
      total,
      active,
      disposed,
      overdue,
      rate,
    };
  });

  const handleExportReport = () => {
    alert(
      'Simulating PDF / CSV Audit Report export for AICTE Central Secretariat and Parliamentary Standing Committee compliance.'
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#E6EFE5] font-mono tracking-tight flex items-center gap-2">
            <span>Executive Analytics & Institutional Reports</span>
            <span className="w-2 h-2 bg-[#C4F279]" />
          </h2>
          <p className="text-xs text-[#A6B7A8]">
            Workload distribution, statutory ageing brackets, and bureau disposal performance matrices.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedReportTimeframe}
            onChange={(e) => setSelectedReportTimeframe(e.target.value as any)}
            className="px-3 py-2 bg-[#222F25] border border-[#35473A] text-xs font-mono text-[#E6EFE5] focus:outline-none focus:border-[#C4F279]"
          >
            <option value="Q3_2026">Q3 FY 2026-27 (Current Quarter)</option>
            <option value="YTD_2026">Year-to-Date (2026-27)</option>
            <option value="ALL_TIME">All-Time Cumulative</option>
          </select>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono transition-colors shadow-xs"
          >
            <Download size={14} />
            <span>Generate Executive Report</span>
          </button>
        </div>
      </div>

      {/* Bureau Performance Table */}
      <div className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#35473A]">
          <div>
            <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
              Bureau-Level Workload & Statutory Disposal Ratios
            </h3>
            <p className="text-[11px] text-[#A6B7A8]">
              Comparative efficiency benchmarks across AICTE administrative divisions.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#141C16] border-b border-[#35473A] text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                <th className="py-2.5 px-3">Bureau Code</th>
                <th className="py-2.5 px-3">Division Name & Head</th>
                <th className="py-2.5 px-3">Total Ingested</th>
                <th className="py-2.5 px-3">Active Inquiries</th>
                <th className="py-2.5 px-3">Disposed</th>
                <th className="py-2.5 px-3">SLA Overdue</th>
                <th className="py-2.5 px-3">Disposal Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#26362A] font-sans">
              {bureauPerformance.map((b) => (
                <tr key={b.code} className="hover:bg-[#222F25] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-[#C4F279]">{b.code}</td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-[#E6EFE5]">{b.name}</div>
                    <div className="text-[10px] font-mono text-[#A6B7A8]">{b.head}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[#E6EFE5]">{b.total}</td>
                  <td className="py-3 px-3 font-mono text-[#E5A93C] font-semibold">{b.active}</td>
                  <td className="py-3 px-3 font-mono text-[#C4F279] font-semibold">{b.disposed}</td>
                  <td className="py-3 px-3 font-mono">
                    <span className={b.overdue > 0 ? 'text-[#FF8BCB] font-bold' : 'text-[#A6B7A8]/50'}>
                      {b.overdue}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-[#222F25] h-2 overflow-hidden border border-[#35473A]">
                        <div className="bg-[#C4F279] h-full" style={{ width: `${b.rate}%` }} />
                      </div>
                      <span className="text-[#E6EFE5] font-bold">{b.rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Column Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Complaint Ageing Analysis */}
        <div className="p-5 border border-[#35473A] bg-[#000000] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#35473A]">
            <div>
              <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                Pending Grievance Ageing Breakdown
              </h3>
              <p className="text-[11px] text-[#A6B7A8]">
                Number of days active complaints have remained in process.
              </p>
            </div>
            <Clock size={16} className="text-[#E5A93C]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#253328" vertical={false} />
                <XAxis
                  dataKey="bracket"
                  interval={0}
                  stroke="#35473A"
                  tick={{ fill: '#A6B7A8', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#35473A"
                  tick={{ fill: '#A6B7A8', fontSize: 11, fontFamily: 'monospace' }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1A241D] border border-[#35473A] p-2.5 shadow-2xl font-mono text-xs">
                          <span className="text-[#E6EFE5] font-bold">{payload[0].payload.bracket}: </span>
                          <span className="text-[#C4F279] font-bold">{payload[0].value} cases</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  isAnimationActive={false}
                  activeBar={false}
                  maxBarSize={72}
                  shape={(props: any) => <DotMatrixBar {...props} orientation="vertical" />}
                >
                  {ageingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Complaints by Geographic Region */}
        <div className="p-5 border border-[#35473A] bg-[#000000] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#35473A]">
            <div>
              <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                Geographic Ingestion by Region
              </h3>
              <p className="text-[11px] text-[#A6B7A8]">
                Regional office case concentrations across India.
              </p>
            </div>
            <TrendingUp size={16} className="text-[#C4F279]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regionData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#253328" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke="#35473A"
                  tick={{ fill: '#A6B7A8', fontSize: 11, fontFamily: 'monospace' }}
                />
                <YAxis
                  dataKey="region"
                  type="category"
                  width={110}
                  stroke="#35473A"
                  tick={{ fill: '#A6B7A8', fontSize: 11, fontFamily: 'monospace' }}
                />
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#1A241D] border border-[#35473A] p-2.5 shadow-2xl font-mono text-xs">
                          <span className="text-[#E6EFE5] font-bold">{payload[0].payload.region}: </span>
                          <span className="text-[#C4F279] font-bold">{payload[0].value} cases</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="complaints"
                  fill="#C4F279"
                  isAnimationActive={false}
                  activeBar={false}
                  maxBarSize={22}
                  shape={(props: any) => <DotMatrixBar {...props} orientation="horizontal" />}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
