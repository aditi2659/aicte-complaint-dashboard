import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useComplaints } from '../context/ComplaintContext';
import { StatCard } from '../components/dashboard/StatCard';
import { WorkloadChart } from '../components/dashboard/WorkloadChart';
import { TrendsChart } from '../components/dashboard/TrendsChart';
import { StatusPieChart } from '../components/dashboard/StatusPieChart';
import { RecentActivityList } from '../components/dashboard/RecentActivityList';
import { RegisterComplaintModal } from '../components/complaints/RegisterComplaintModal';
import {
  FileText,
  Clock,
  Hourglass,
  CheckCircle2,
  ArrowRightLeft,
  AlertOctagon,
  GitMerge,
  PlusCircle,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Activity,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { getStats, analyticsAlerts } = useComplaints();
  const stats = getStats();
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  return (
    <div className="mx-auto max-w-[1600px] space-y-7 bg-black px-1 pb-12 text-[#F5F5F5] sm:px-2">
      {/* Predictive Analytics Early-Warning Alert */}
      {analyticsAlerts && analyticsAlerts.length > 0 && (
        <section
          className="relative flex flex-col items-start justify-between gap-4 overflow-hidden border border-[#E5A93C]/35 bg-[#E5A93C]/[0.06] p-4 sm:flex-row sm:items-center sm:p-5"
          aria-label="Predictive early-warning alerts"
        >
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#E5A93C]" />

          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 border border-[#E5A93C]/40 bg-[#E5A93C]/10 p-3 text-[#E5A93C]">
              <AlertTriangle size={21} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  {analyticsAlerts.length} Predictive Early-Warning Alert{analyticsAlerts.length === 1 ? '' : 's'} Active
                </h3>
                <span className="border border-[#E5A93C]/40 bg-[#E5A93C]/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[#E5A93C]">
                  Action recommended
                </span>
              </div>

              <p className="mt-1 max-w-4xl text-xs leading-5 text-[#A3A3A3]">
                AICTE predictive analytics engine identified {analyticsAlerts.length} case{analyticsAlerts.length === 1 ? '' : 's'} with crossed deadlines, approaching SLA limits, or prolonged inactivity.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/reports')}
            className="inline-flex shrink-0 items-center gap-2 bg-[#E5A93C] px-4 py-3 font-mono text-xs font-bold text-black transition-colors hover:bg-[#F3B84C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            Inspect priority list
            <ExternalLink size={14} />
          </button>
        </section>
      )}

      {/* Cross-bureau overlap alert */}
      {stats.openOverlapAlerts > 0 && (
        <section
          className="relative flex flex-col items-start justify-between gap-4 overflow-hidden border border-[#FF69B4]/35 bg-[#FF69B4]/[0.06] p-4 sm:flex-row sm:items-center sm:p-5"
          aria-label="Unreviewed overlap alerts"
        >
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#FF69B4]" />

          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 border border-[#FF69B4]/40 bg-[#FF69B4]/10 p-3 text-[#FF69B4]">
              <GitMerge size={21} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  {stats.openOverlapAlerts} Unreviewed Cross-Bureau Overlap
                  {stats.openOverlapAlerts === 1 ? '' : 's'} Flagged
                </h3>
                <span className="border border-[#FF69B4]/40 bg-[#FF69B4]/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-[#FF69B4]">
                  Action required
                </span>
              </div>

              <p className="mt-1 max-w-4xl text-xs leading-5 text-[#A3A3A3]">
                Potentially related grievances have been identified across
                bureaus. Human review is required before coordinating
                inquiries or taking further action.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/overlaps')}
            className="inline-flex shrink-0 items-center gap-2 bg-[#FF69B4] px-4 py-3 font-mono text-xs font-bold text-black transition-colors hover:bg-[#FF8BCB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF69B4]"
          >
            Review overlaps
            <ExternalLink size={14} />
          </button>
        </section>
      )}

      {/* Dashboard heading */}
      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 bg-[#C4F279]" />
            <h2 className="text-lg font-bold tracking-tight text-[#F5F5F5] sm:text-xl">
              Executive Grievance Telemetry
            </h2>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#A3A3A3] sm:text-sm">
            Real-time compliance, bureau workload distribution, and statutory
            resolution tracking.
          </p>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="inline-flex shrink-0 items-center gap-2 border border-[#647D48] bg-[#252D20] px-4 py-3 font-mono text-xs font-semibold text-[#D5FF91] transition-all duration-200 hover:border-[#C4F279] hover:bg-[#303B27] hover:shadow-[0_0_12px_rgba(196,242,121,0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4F279]"
        >
          <PlusCircle size={16} />
          Register complaint
        </button>
      </section>

      {/* KPI cards */}
      <section aria-label="Complaint summary metrics">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#888888]">
            Case overview
          </p>
          <span className="h-px flex-1 bg-[#292929] ml-4" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          <StatCard
            title="Total Ingested"
            value={stats.total}
            subtitle="All bureaus & cells"
            icon={FileText}
            accent="slate"
            onClick={() => navigate('/complaints')}
          />
          <StatCard
            title="Pending"
            value={stats.pending}
            subtitle="Awaiting triage"
            icon={Clock}
            accent="amber"
            onClick={() => navigate('/complaints?status=PENDING')}
          />
          <StatCard
            title="Under Process"
            value={stats.underProcess}
            subtitle="Active hearings"
            icon={Hourglass}
            accent="green"
            onClick={() => navigate('/complaints?status=UNDER_PROCESS')}
          />
          <StatCard
            title="Disposed"
            value={stats.disposed}
            subtitle="Final orders issued"
            icon={CheckCircle2}
            accent="cyan"
            onClick={() => navigate('/complaints?status=DISPOSED')}
          />
          <StatCard
            title="Transferred"
            value={stats.transferred}
            subtitle="Inter-bureau shift"
            icon={ArrowRightLeft}
            accent="slate"
            onClick={() => navigate('/complaints?status=TRANSFERRED')}
          />
          <StatCard
            title="SLA Overdue"
            value={stats.overdue}
            subtitle="Beyond statutory limit"
            icon={AlertOctagon}
            accent="pink"
            onClick={() => navigate('/complaints?overdue=true')}
          />
          <StatCard
            title="Overlap Flags"
            value={stats.openOverlapAlerts}
            subtitle="Cross-bureau matches"
            icon={GitMerge}
            accent="pink"
            onClick={() => navigate('/overlaps')}
          />
        </div>
      </section>

      {/* Workload and status charts */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <article className="relative min-w-0 overflow-hidden border border-[#292929] bg-[#080808] p-4 sm:p-5 lg:col-span-2">
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#C4F279]" />

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-1.5 w-1.5 bg-[#C4F279]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  Bureau-Wise Workload &amp; Ingestion Volume
                </h3>
                <span className="border border-[#C4F279]/30 bg-[#C4F279]/[0.06] px-2 py-1 font-mono text-[10px] text-[#C4F279]">
                  Interactive
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">
                Select a bureau column to filter complaints in the registry.
              </p>
            </div>
            <TrendingUp size={17} className="shrink-0 text-[#C4F279]" />
          </div>

          <WorkloadChart />
        </article>

        <article className="relative min-w-0 overflow-hidden border border-[#292929] bg-[#080808] p-4 sm:p-5">
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#FF69B4]" />

          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-[#FF69B4]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  Status Distribution
                </h3>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">
                Current operational posture
              </p>
            </div>
            <Activity size={17} className="shrink-0 text-[#FF69B4]" />
          </div>

          <StatusPieChart />
        </article>
      </section>

      {/* Monthly trends and recent activity */}
      <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <article className="relative min-w-0 self-start overflow-hidden border border-[#292929] bg-[#080808] p-4 sm:p-5 lg:col-span-2">
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#FF69B4]" />

          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-1.5 w-1.5 bg-[#FF69B4]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  Monthly Intake vs Disposal Trajectory
                </h3>
                <span className="border border-[#FF69B4]/30 bg-[#FF69B4]/[0.06] px-2 py-1 font-mono text-[10px] text-[#FF8BCB]">
                  6-month aggregate
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#A3A3A3]">
                New grievances registered versus final disposal decisions
                rendered.
              </p>
            </div>
            <TrendingUp size={17} className="shrink-0 text-[#FF8BCB]" />
          </div>

          <TrendsChart />
        </article>

        <article className="relative min-w-0 overflow-hidden border border-[#292929] bg-[#080808] p-4 sm:p-5">
          <span className="absolute right-0 top-0 h-2 w-2 bg-[#C4F279]" />

          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 bg-[#C4F279]" />
                <h3 className="text-sm font-semibold tracking-tight text-[#F5F5F5]">
                  Recent Case Actions
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/complaints')}
              className="shrink-0 text-xs font-medium text-[#FF69B4] transition-colors hover:text-[#FF8BCB]"
            >
              View all →
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto pr-2 overscroll-contain [scrollbar-color:#454545_#080808] [scrollbar-width:thin]">
            <RecentActivityList />
          </div>
        </article>
      </section>

      {/* Complaint registration modal */}
      {showRegisterModal && (
        <RegisterComplaintModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
    </div>
  );
};
