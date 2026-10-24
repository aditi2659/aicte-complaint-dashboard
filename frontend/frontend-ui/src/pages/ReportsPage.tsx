import React, { useId, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Download,
  Clock,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  RefreshCw,
  Activity,
  CheckCircle2,
  ExternalLink,
  Layers,
  ChevronRight,
  GitMerge,
  ArrowRight
} from 'lucide-react';
import { BUREAUS } from '../data/mockData';
import { BureauBadge } from '../components/common/Badge';

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
        <rect x={left} y={top} width={w} height={h} fill={fill} opacity={0.08} />
        <rect x={left} y={top} width={w} height={h} fill={`url(#${patternId})`} />
      </g>
    </g>
  );
};

export const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    complaints,
    isOverdue,
    currentUser,
    analyticsAlerts,
    priorityCases,
    riskCases,
    patterns,
    analyticsLoading,
    analyticsError,
    reloadAnalytics,
    fetchPriorityList
  } = useComplaints();

  const [selectedReportTimeframe, setSelectedReportTimeframe] = useState<
    'Q3_2026' | 'YTD_2026' | 'ALL_TIME'
  >('Q3_2026');

  const [priorityLimit, setPriorityLimit] = useState<number>(10);
  const [selectedRiskTab, setSelectedRiskTab] = useState<'ALL' | 'HIGH' | 'MEDIUM'>('ALL');

  // Trigger priority fetch when user changes limit
  const handleLimitChange = (newLimit: number) => {
    setPriorityLimit(newLimit);
    fetchPriorityList(newLimit);
  };

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

  // Filter risk cases for tab
  const filteredRiskCases = (riskCases || []).filter((c) => {
    if (selectedRiskTab === 'HIGH') return c.risk?.level === 'High';
    if (selectedRiskTab === 'MEDIUM') return c.risk?.level === 'Medium';
    return true;
  });

  const handleExportReport = () => {
    alert(
      'Exporting AICTE Executive & Predictive Analytics Audit Report (CSV / PDF format).'
    );
  };

  const getSeverityBadgeClass = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s === 'high' || s === 'critical') {
      return 'bg-[#FF8BCB]/15 text-[#FF8BCB] border border-[#FF8BCB]/40';
    }
    if (s === 'medium') {
      return 'bg-[#E5A93C]/15 text-[#E5A93C] border border-[#E5A93C]/40';
    }
    return 'bg-[#C4F279]/15 text-[#C4F279] border border-[#C4F279]/40';
  };

  const getAlertTypeText = (type: string) => {
    switch (type) {
      case 'deadline_crossed':
        return 'Deadline Crossed';
      case 'deadline_approaching':
        return 'Deadline Approaching';
      case 'pending_reminder':
        return 'Action Overdue';
      case 'escalation':
        return 'Escalated Case';
      default:
        return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-[#E6EFE5] font-mono tracking-tight flex items-center gap-2">
              <span>Executive Analytics & Institutional Reports</span>
              <span className="w-2 h-2 bg-[#C4F279]" />
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase font-bold tracking-wider bg-[#C4F279]/10 text-[#C4F279] border border-[#C4F279]/30">
              Live Backend
            </span>
          </div>
          <p className="text-xs text-[#A6B7A8] mt-1">
            Real-time predictive analytics, early-warning anomaly detection, and statutory compliance telemetry.
            {currentUser?.bureau && (
              <span className="ml-2 text-[#C4F279] font-mono font-medium">
                [Scope: {currentUser.bureau} Authorized Data]
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => reloadAnalytics(priorityLimit)}
            disabled={analyticsLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#222F25] hover:bg-[#2A3B2E] border border-[#35473A] text-xs font-mono text-[#E6EFE5] transition-colors disabled:opacity-50"
            title="Refresh live predictive analytics from backend"
          >
            <RefreshCw size={13} className={analyticsLoading ? 'animate-spin text-[#C4F279]' : 'text-[#A6B7A8]'} />
            <span>{analyticsLoading ? 'Syncing...' : 'Sync Telemetry'}</span>
          </button>

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

      {/* API Error State Banner (Explicit, No Silent Mocking) */}
      {analyticsError && (
        <div
          role="alert"
          className="p-4 bg-[#FF8BCB]/10 border border-[#FF8BCB]/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2.5 text-[#FF8BCB]">
            <AlertOctagon size={18} className="shrink-0" />
            <div>
              <span className="font-mono font-bold uppercase tracking-wider block sm:inline mr-2">
                Predictive Analytics API Error:
              </span>
              <span className="text-[#F5F5F5]">{analyticsError}</span>
            </div>
          </div>
          <button
            onClick={() => reloadAnalytics(priorityLimit)}
            className="px-3 py-1 bg-[#FF8BCB] text-black font-mono font-bold text-xs uppercase hover:bg-[#FF69B4] transition-colors shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* SECTION 1: EARLY WARNING SYSTEM ALERTS (GET /api/v1/analytics/alerts) */}
      <section className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4" aria-label="Early Warning Alerts">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#35473A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FF8BCB]/10 border border-[#FF8BCB]/30 text-[#FF8BCB]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                  Early-Warning Anomaly Alerts
                </h3>
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40">
                  {analyticsAlerts?.length || 0} Flagged
                </span>
              </div>
              <p className="text-[11px] text-[#A6B7A8]">
                Automated detection of crossed deadlines, upcoming SLA expirations, and inactive cases from live telemetry.
              </p>
            </div>
          </div>
        </div>

        {/* Alerts Content */}
        {analyticsLoading && (!analyticsAlerts || analyticsAlerts.length === 0) ? (
          <div className="p-8 text-center text-xs font-mono text-[#A6B7A8] space-y-2">
            <RefreshCw size={20} className="animate-spin mx-auto text-[#C4F279]" />
            <p>Evaluating active cases against predictive risk models...</p>
          </div>
        ) : !analyticsAlerts || analyticsAlerts.length === 0 ? (
          /* Empty State */
          <div className="p-6 bg-[#141C16] border border-[#26362A] text-center space-y-2">
            <CheckCircle2 size={24} className="mx-auto text-[#C4F279]" />
            <p className="text-xs font-mono font-semibold text-[#E6EFE5]">
              No Early-Warning Alerts Detected
            </p>
            <p className="text-[11px] text-[#A6B7A8] max-w-md mx-auto">
              All active complaints in your bureau are currently moving within statutory SLA timelines with recent logged actions.
            </p>
          </div>
        ) : (
          /* Alert List */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analyticsAlerts.map((alert, idx) => (
              <div
                key={`${alert.complaint_id}-${alert.type}-${idx}`}
                className="p-3.5 bg-[#141C16] border border-[#26362A] hover:border-[#35473A] transition-colors flex flex-col justify-between gap-2.5 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${getSeverityBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="px-2 py-0.5 font-mono text-[10px] text-[#E6EFE5] bg-[#222F25] border border-[#35473A]">
                      {getAlertTypeText(alert.type)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#A6B7A8]/60">
                    {alert.bureau}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-medium text-[#E6EFE5] leading-relaxed">
                    {alert.message}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#26362A]/60 text-[10px] font-mono">
                  <span className="text-[#A6B7A8]">
                    ID: <strong className="text-[#C4F279]">{alert.complaint_id}</strong>
                  </span>
                  <button
                    onClick={() => navigate(`/complaints?search=${encodeURIComponent(alert.complaint_id)}`)}
                    className="inline-flex items-center gap-1 text-[#FF8BCB] hover:text-[#FF69B4] transition-colors"
                  >
                    <span>Inspect Case</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 2: PRIORITIZED ACTION QUEUE (GET /api/v1/analytics/priority-list) */}
      <section className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4" aria-label="Priority List">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#35473A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#E5A93C]/10 border border-[#E5A93C]/30 text-[#E5A93C]">
              <Clock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                  Urgent Attention Priority Queue
                </h3>
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/40">
                  Needs Attention First
                </span>
              </div>
              <p className="text-[11px] text-[#A6B7A8]">
                Real-time sorting by risk score, SLA remaining days, and escalation flags from the backend analytics engine.
              </p>
            </div>
          </div>

          {/* Limit selector */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-[#A6B7A8] text-[11px]">Show Top:</span>
            {[5, 10, 20].map((lim) => (
              <button
                key={lim}
                onClick={() => handleLimitChange(lim)}
                className={`px-2.5 py-1 text-xs border font-mono transition-colors ${
                  priorityLimit === lim
                    ? 'bg-[#C4F279] text-black font-bold border-[#C4F279]'
                    : 'bg-[#222F25] text-[#A6B7A8] border-[#35473A] hover:border-[#C4F279]'
                }`}
              >
                {lim}
              </button>
            ))}
          </div>
        </div>

        {/* Priority List Content */}
        {analyticsLoading && (!priorityCases || priorityCases.length === 0) ? (
          <div className="p-8 text-center text-xs font-mono text-[#A6B7A8]">
            <RefreshCw size={20} className="animate-spin mx-auto text-[#C4F279] mb-2" />
            Loading prioritized grievance queue...
          </div>
        ) : !priorityCases || priorityCases.length === 0 ? (
          <div className="p-6 bg-[#141C16] border border-[#26362A] text-center space-y-2">
            <CheckCircle2 size={24} className="mx-auto text-[#C4F279]" />
            <p className="text-xs font-mono font-semibold text-[#E6EFE5]">
              No Open Priority Cases Requiring Attention
            </p>
            <p className="text-[11px] text-[#A6B7A8]">
              All open complaints are operating within acceptable risk thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-[#141C16] border-b border-[#35473A] text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                  <th className="py-2.5 px-3">Complaint ID</th>
                  <th className="py-2.5 px-3">Bureau / Cell</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">SLA Timeline</th>
                  <th className="py-2.5 px-3">Risk Assessment</th>
                  <th className="py-2.5 px-3">Identified Risk Drivers</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#26362A]">
                {priorityCases.map((c) => {
                  const isNegative = c.days_left !== null && c.days_left < 0;
                  const isZero = c.days_left === 0;

                  return (
                    <tr key={c.complaint_id} className="hover:bg-[#222F25] transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#E6EFE5]">
                        <div className="flex items-center gap-1.5">
                          <span>{c.complaint_id}</span>
                          {c.is_escalated && (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40">
                              Escalated
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[11px] font-mono text-[#A6B7A8]">
                        {c.bureau}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#222F25] text-[#E6EFE5] border border-[#35473A]">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {c.days_left === null ? (
                          <span className="text-[#A6B7A8]/50">No SLA</span>
                        ) : isNegative ? (
                          <span className="text-[#FF8BCB] font-bold">
                            {Math.abs(c.days_left)}d overdue
                          </span>
                        ) : isZero ? (
                          <span className="text-[#E5A93C] font-bold">Due today</span>
                        ) : (
                          <span className="text-[#C4F279] font-bold">
                            {c.days_left}d remaining
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              c.level === 'High'
                                ? 'bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40'
                                : c.level === 'Medium'
                                ? 'bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/40'
                                : 'bg-[#C4F279]/20 text-[#C4F279] border border-[#C4F279]/40'
                            }`}
                          >
                            {c.level} ({c.score})
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <ul className="text-[11px] text-[#A6B7A8] space-y-0.5 max-w-sm">
                          {(c.reasons || []).map((reason, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-1">
                              <span className="text-[#E5A93C] font-mono">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => navigate(`/complaints?search=${encodeURIComponent(c.complaint_id)}`)}
                          className="px-2.5 py-1 bg-[#222F25] hover:bg-[#35473A] text-[#C4F279] font-mono text-[11px] font-semibold border border-[#35473A] transition-colors"
                        >
                          View Case →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SECTION 3: PATTERN INTELLIGENCE (GET /api/v1/analytics/patterns) */}
      <section className="p-5 border border-[#35473A] bg-[#000000] space-y-4" aria-label="Pattern Intelligence">
        <div className="flex items-center justify-between pb-3 border-b border-[#35473A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#C4F279]/10 border border-[#C4F279]/30 text-[#C4F279]">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                Pattern & Institutional Intelligence
              </h3>
              <p className="text-[11px] text-[#A6B7A8]">
                Cross-institution recurring grievances, 30-day category surges, and high-density regional hotspots.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Repeated Categories */}
          <div className="p-4 bg-[#141C16] border border-[#26362A] space-y-3">
            <div className="flex items-center justify-between border-b border-[#26362A] pb-2">
              <span className="font-mono text-xs font-bold text-[#E6EFE5]">
                Recurring Institution Clusters
              </span>
              <span className="text-[10px] font-mono text-[#A6B7A8]">90-day window</span>
            </div>
            {!patterns?.repeatedCategories || patterns.repeatedCategories.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-[#A6B7A8] font-mono">
                No repeated complaint clusters detected (&gt;= 3 complaints in 90 days for same institute).
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.repeatedCategories.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#1A241D] border border-[#35473A] text-xs space-y-1">
                    <div className="flex justify-between font-mono font-bold text-[#FF8BCB]">
                      <span>{item.institution_id}</span>
                      <span>{item.count} complaints</span>
                    </div>
                    <div className="text-[11px] text-[#E6EFE5] font-medium">{item.category}</div>
                    <p className="text-[10px] text-[#A6B7A8]">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Rising Categories */}
          <div className="p-4 bg-[#141C16] border border-[#26362A] space-y-3">
            <div className="flex items-center justify-between border-b border-[#26362A] pb-2">
              <span className="font-mono text-xs font-bold text-[#E6EFE5]">
                Surging Grievance Categories
              </span>
              <span className="text-[10px] font-mono text-[#A6B7A8]">Last 30d vs Prior 30d</span>
            </div>
            {!patterns?.risingCategories || patterns.risingCategories.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-[#A6B7A8] font-mono">
                No categories showing sudden surge in volume compared to previous 30-day baseline.
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.risingCategories.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#1A241D] border border-[#35473A] text-xs space-y-1">
                    <div className="flex justify-between font-mono font-bold text-[#E5A93C]">
                      <span>{item.category}</span>
                      <span>+{item.recent - item.previous} increase</span>
                    </div>
                    <p className="text-[10px] text-[#A6B7A8]">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Busy Regions */}
          <div className="p-4 bg-[#141C16] border border-[#26362A] space-y-3">
            <div className="flex items-center justify-between border-b border-[#26362A] pb-2">
              <span className="font-mono text-xs font-bold text-[#E6EFE5]">
                High-Density Geographic Hubs
              </span>
              <span className="text-[10px] font-mono text-[#A6B7A8]">Last 30 days</span>
            </div>
            {!patterns?.busyRegions || patterns.busyRegions.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-[#A6B7A8] font-mono">
                No single regional office exceeding baseline workload concentration.
              </div>
            ) : (
              <div className="space-y-2">
                {patterns.busyRegions.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-[#1A241D] border border-[#35473A] text-xs space-y-1">
                    <div className="flex justify-between font-mono font-bold text-[#C4F279]">
                      <span>{item.region}</span>
                      <span>{item.count} cases</span>
                    </div>
                    <p className="text-[10px] text-[#A6B7A8]">{item.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 4: HIGH-RISK GRIEVANCE INQUIRIES (GET /api/v1/analytics/risk-cases) */}
      <section className="p-5 border border-[#35473A] bg-[#1A241D] space-y-4" aria-label="Risk Scored Inquiries">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#35473A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FF8BCB]/10 border border-[#FF8BCB]/30 text-[#FF8BCB]">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[#E6EFE5] text-sm font-mono tracking-wide">
                  Open Grievance Predictive Risk Breakdown
                </h3>
                <span className="px-2 py-0.5 font-mono text-[10px] font-bold bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40">
                  {filteredRiskCases.length} Scored Cases
                </span>
              </div>
              <p className="text-[11px] text-[#A6B7A8]">
                Multivariate risk evaluation (due dates, idle time, inter-bureau transfers, overlap correlations).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono">
            {(['ALL', 'HIGH', 'MEDIUM'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedRiskTab(tab)}
                className={`px-3 py-1 text-xs border font-mono transition-colors ${
                  selectedRiskTab === tab
                    ? 'bg-[#FF8BCB] text-black font-bold border-[#FF8BCB]'
                    : 'bg-[#222F25] text-[#A6B7A8] border-[#35473A] hover:border-[#FF8BCB]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {analyticsLoading && (!filteredRiskCases || filteredRiskCases.length === 0) ? (
          <div className="p-8 text-center text-xs font-mono text-[#A6B7A8]">
            <RefreshCw size={20} className="animate-spin mx-auto text-[#C4F279] mb-2" />
            Loading predictive risk calculations...
          </div>
        ) : filteredRiskCases.length === 0 ? (
          <div className="p-6 bg-[#141C16] border border-[#26362A] text-center space-y-2">
            <CheckCircle2 size={24} className="mx-auto text-[#C4F279]" />
            <p className="text-xs font-mono font-semibold text-[#E6EFE5]">
              No Open Cases Matching Selected Filter
            </p>
            <p className="text-[11px] text-[#A6B7A8]">
              No active cases currently meet the {selectedRiskTab} risk threshold.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRiskCases.map((c) => (
              <div
                key={c.complaint_id}
                className="p-3.5 bg-[#141C16] border border-[#26362A] hover:border-[#35473A] transition-colors flex flex-col justify-between gap-3 relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-xs text-[#E6EFE5] flex items-center gap-1.5">
                      <span>{c.complaint_id}</span>
                      {c.has_overlap && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40" title="Strong Cross-Bureau Overlap">
                          Overlap
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#A6B7A8] font-medium mt-0.5">
                      {c.category}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                      c.risk.level === 'High'
                        ? 'bg-[#FF8BCB]/20 text-[#FF8BCB] border border-[#FF8BCB]/40'
                        : 'bg-[#E5A93C]/20 text-[#E5A93C] border border-[#E5A93C]/40'
                    }`}
                  >
                    Risk {c.risk.score} ({c.risk.level})
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px] text-[#A6B7A8]">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span>Bureau:</span>
                    <span className="text-[#E6EFE5]">{c.bureau}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span>Transfers:</span>
                    <span className="text-[#E6EFE5]">{c.transfer_count}</span>
                  </div>
                  <div className="pt-1.5 border-t border-[#26362A]">
                    <div className="text-[10px] font-mono text-[#A6B7A8]/70 mb-1">Risk Factors:</div>
                    <ul className="space-y-0.5">
                      {c.risk.reasons.map((r, rIdx) => (
                        <li key={rIdx} className="text-[10px] font-mono text-[#E5A93C] flex items-start gap-1">
                          <span>•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#26362A] flex justify-end">
                  <button
                    onClick={() => navigate(`/complaints?search=${encodeURIComponent(c.complaint_id)}`)}
                    className="text-[10px] font-mono font-bold text-[#C4F279] hover:underline flex items-center gap-1"
                  >
                    Inspect in Registry <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 5: BUREAU PERFORMANCE TABLE */}
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

      {/* SECTION 6: 2-COLUMN ANALYTICS CHARTS */}
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
