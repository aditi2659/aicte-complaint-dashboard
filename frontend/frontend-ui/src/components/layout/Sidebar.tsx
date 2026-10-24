import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  GitMerge,
  Building2,
  BarChart3,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useComplaints } from '../../context/ComplaintContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
}) => {
  const { complaints, overlaps, resetToInitialData } = useComplaints();

  const unreviewedOverlaps = overlaps.filter(
    (o) => o.reviewStatus === 'UNREVIEWED',
  ).length;

  const activeComplaints = complaints.filter(
    (c) => c.status !== 'DISPOSED',
  ).length;

  const navItems = [
    {
      to: '/',
      label: 'Executive Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/complaints',
      label: 'Complaint Registry',
      icon: FileText,
      badge: activeComplaints > 0 ? `${activeComplaints}` : null,
      badgeVariant: 'lime',
    },
    {
      to: '/overlaps',
      label: 'Overlap Detection',
      icon: GitMerge,
      badge: unreviewedOverlaps > 0 ? `${unreviewedOverlaps} Alert` : null,
      badgeVariant: 'pink',
    },
    {
      to: '/institutions',
      label: 'Institution Directory',
      icon: Building2,
      badge: null,
    },
    {
      to: '/reports',
      label: 'Reports & Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      to: '/admin',
      label: 'Admin & Audit Trail',
      icon: ShieldCheck,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed bottom-0 left-0 top-0 z-50 flex w-64 shrink-0 select-none flex-col
          border-r border-[#292929] bg-[#080808]
          transition-transform duration-200 ease-in-out
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand header */}
        <div className="border-b border-[#292929] bg-[#080808] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Pixel brand mark */}
              <div className="relative flex h-10 w-10 shrink-0 flex-col justify-between overflow-hidden border border-[#FF69B4]/40 bg-[#FF69B4]/[0.06] p-2">
                <div className="pointer-events-none absolute right-1 top-1 flex flex-col gap-0.5">
                  <div className="flex justify-end gap-0.5">
                    <span className="h-1 w-1 bg-[#C4F279]/30" />
                    <span className="h-1 w-1 bg-[#C4F279]" />
                  </div>
                  <div className="flex justify-end gap-0.5">
                    <span className="h-1 w-1 bg-[#FF69B4]" />
                    <span className="h-1 w-1 bg-[#C4F279]/60" />
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-0.5 font-mono text-xs font-black tracking-tighter">
                  <span className="text-[#C4F279]">AI</span>
                  <span className="text-[#FF69B4]">CTE</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="whitespace-nowrap font-mono text-xs font-bold tracking-wide text-[#F5F5F5]">
                    AICTE <span className="text-[#FF69B4]">•</span> IICMD
                  </h1>
                  <span className="border border-[#C4F279]/40 bg-[#C4F279]/10 px-1 py-0.5 font-mono text-[9px] text-[#C4F279]">
                    v2.6
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] font-medium tracking-tight text-[#A3A3A3]">
                  Institution Complaint Monitor
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-[#A3A3A3] transition-colors hover:text-[#FF69B4] lg:hidden"
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Cross-bureau sync indicator */}
          <div className="mt-3 flex items-center justify-between border border-[#292929] bg-[#111111] px-2.5 py-1 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-[#C4F279]" />
              <span className="text-[#A3A3A3]">RB • PGRC • AB</span>
            </span>
            <span className="text-[10px] font-semibold text-[#C4F279]">
              Active Sync
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <div className="flex items-center justify-between px-3 pb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#777777]">
            <span>Operations &amp; Oversight</span>
            <span className="h-1 w-1 bg-[#FF69B4]/70" />
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-[#C4F279]/[0.08] font-semibold text-[#C4F279]'
                    : 'text-[#A3A3A3] hover:bg-[#141414] hover:text-[#F5F5F5]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute bottom-1/2 left-0 flex -translate-y-1/2 flex-col gap-0.5">
                      <span className="h-1 w-0.5 bg-[#C4F279]/40" />
                      <span className="h-3 w-1 bg-[#C4F279]" />
                      <span className="h-1 w-0.5 bg-[#C4F279]/40" />
                    </div>
                  )}

                  <div className="flex min-w-0 items-center gap-2.5">
                    <item.icon
                      size={16}
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#C4F279]'
                          : 'text-[#777777] group-hover:text-[#FF8BCB]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`ml-2 shrink-0 border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        item.badgeVariant === 'pink'
                          ? 'border-[#FF69B4]/40 bg-[#FF69B4]/10 text-[#FF69B4]'
                          : 'border-[#C4F279]/40 bg-[#C4F279]/10 text-[#C4F279]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Prototype information and demo reset */}
        <div className="space-y-2 border-t border-[#292929] bg-[#080808] p-3">
          <div className="border border-[#292929] bg-[#111111] p-2.5 text-[11px] text-[#A3A3A3]">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-[#FF69B4]">
              <Sparkles size={13} />
              <span>AICTE Prototype Sandbox</span>
            </div>
            <p className="text-[10px] leading-relaxed text-[#888888]">
              Simulated institutional data for cross-bureau overlap evaluation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset all portal records (complaints, overlaps, audit trails) to initial demonstration state?',
                )
              ) {
                resetToInitialData();
              }
            }}
            className="flex w-full items-center justify-center gap-1.5 border border-[#292929] bg-[#111111] px-3 py-2 font-mono text-[11px] text-[#A3A3A3] transition-colors hover:border-[#C4F279]/40 hover:bg-[#171717] hover:text-[#C4F279]"
            title="Restore initial fictional dataset"
          >
            <RotateCcw size={12} />
            <span>Reset Sample Data</span>
          </button>
        </div>
      </aside>
    </>
  );
};
