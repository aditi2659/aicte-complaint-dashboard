import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useComplaints } from '../../context/ComplaintContext';

export const AppLayout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { dataSource, apiError, apiLoading, reloadFromApi, useMockFallback } = useComplaints();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#101713] text-[#E6EFE5] bg-pixel-grid font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <Topbar
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        {/* Explicit Backend API Status / Development Fallback Banner */}
        {dataSource === 'fallback' && (
          <div className="bg-[#2D1B1F] border-b border-[#FF8BCB]/40 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono text-[#FF8BCB] shrink-0 z-20">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FF8BCB] animate-pulse shrink-0" />
              <span className="font-bold">DEVELOPMENT FALLBACK ACTIVE:</span>
              <span className="text-[#E6EFE5] truncate max-w-xl">
                {apiError || 'Live Express API unreachable. Operating on explicit local mock data.'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 sm:mt-0 shrink-0">
              <button
                type="button"
                onClick={() => reloadFromApi().catch(() => {})}
                disabled={apiLoading}
                className="px-2.5 py-1 bg-[#FF8BCB]/20 hover:bg-[#FF8BCB]/30 border border-[#FF8BCB]/60 text-xs text-[#FF8BCB] transition-colors"
              >
                {apiLoading ? 'Connecting...' : 'Retry Live API'}
              </button>
              <button
                type="button"
                onClick={useMockFallback}
                className="px-2 py-1 text-[#8EA490] hover:text-[#E6EFE5] text-xs transition-colors"
              >
                Reset Mock Baseline
              </button>
            </div>
          </div>
        )}

        {dataSource === 'api' && (
          <div className="bg-[#121B14] border-b border-[#35473A] px-4 py-1 flex items-center justify-between text-[11px] font-mono text-[#C4F279] shrink-0 z-20">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C4F279]" />
              <span>LIVE BACKEND CONNECTED (/api/v1)</span>
            </div>
            <button
              type="button"
              onClick={() => reloadFromApi().catch(() => {})}
              disabled={apiLoading}
              className="text-[10px] text-[#8EA490] hover:text-[#C4F279] transition-colors"
            >
              {apiLoading ? 'Syncing...' : 'Sync Live'}
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 min-h-0 min-w-0 w-full bg-[#000000]/70">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
