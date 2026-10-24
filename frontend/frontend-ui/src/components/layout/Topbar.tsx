import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PlusCircle,
  ChevronDown,
  GitMerge,
  Search,
  ExternalLink,
  Menu
} from 'lucide-react';
import { useComplaints } from '../../context/ComplaintContext';
import { SYSTEM_USERS } from '../../data/mockData';
import { RegisterComplaintModal } from '../complaints/RegisterComplaintModal';
import { LoginModal } from '../auth/LoginModal';

interface TopbarProps {
  onToggleSidebar?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { overlaps, currentUser, setCurrentUser } = useComplaints();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const unreviewedOverlaps = overlaps.filter(o => o.reviewStatus === 'UNREVIEWED');

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Executive Oversight Dashboard';
    if (path.startsWith('/complaints/')) return 'Complaint Case Dossier';
    if (path === '/complaints') return 'National Complaint Registry';
    if (path === '/overlaps') return 'Cross-Bureau Overlap Detection Centre';
    if (path.startsWith('/institutions/')) return 'Institution Profile & History';
    if (path === '/institutions') return 'Institution Master Directory';
    if (path === '/reports') return 'System Analytics & Workload Reports';
    if (path === '/admin') return 'Administration, Roles & Audit Trails';
    return 'AICTE Integrated Grievance Portal';
  };

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearch.trim()) return;
    navigate(`/complaints?search=${encodeURIComponent(quickSearch.trim())}`);
  };

  return (
    <>
      <header className="h-16 bg-[#000000] border-b border-[#35473A] px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0 sticky top-0 z-30 min-w-0 w-full">
        {/* Left: Mobile hamburger + View title */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 text-[#B8CBB9] hover:text-[#E6EFE5] hover:bg-[#1A241D] border border-[#35473A] transition-colors shrink-0"
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="w-1.5 h-1.5 bg-[#C4F279] shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold text-[#E6EFE5] font-mono tracking-tight truncate">
                {getPageTitle()}
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#B8CBB9] truncate hidden sm:block">
              All India Council for Technical Education • Regulatory Portal
            </p>
          </div>
        </div>

        {/* Center: Search (visible on wide screens without causing layout push) */}
        <div className="hidden xl:flex items-center max-w-[200px] 2xl:max-w-xs w-full mx-2 shrink">
          <form onSubmit={handleQuickSearchSubmit} className="relative w-full">
            <Search size={14} className="absolute left-3 top-2.5 text-[#8EA490]" />
            <input
              type="text"
              placeholder="Search case #, institute..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[#1A241D] border border-[#35473A] text-[#E6EFE5] placeholder-[#8EA490] focus:outline-none focus:border-[#C4F279] focus:ring-1 focus:ring-[#C4F279]/30"
            />
          </form>
        </div>

        {/* Right Actions - Gracefully adapts and wraps without overflow */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Overlap notification badge */}
          {unreviewedOverlaps.length > 0 && (
            <button
              onClick={() => navigate('/overlaps')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#FF8BCB]/12 border border-[#FF8BCB]/50 hover:bg-[#FF8BCB]/22 text-[#FF8BCB] text-xs font-mono transition-all group shrink-0"
              title="Review unconfirmed cross-bureau overlap flags"
            >
              <GitMerge size={13} className="text-[#FF8BCB]" />
              <span className="font-bold whitespace-nowrap">
                {unreviewedOverlaps.length} <span className="hidden sm:inline">Overlap Alert</span>
              </span>
              <ExternalLink size={10} className="opacity-70 group-hover:opacity-100 hidden md:inline" />
            </button>
          )}

          {/* Register Complaint Shortcut */}
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono transition-colors shadow-xs shrink-0"
          >
            <PlusCircle size={14} />
            <span className="hidden md:inline whitespace-nowrap">Register Complaint</span>
          </button>

          {/* User Profile / Switcher Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-2 py-1.5 bg-[#1A241D] border border-[#35473A] hover:border-[#4E6654] transition-colors"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 bg-[#222F25] border border-[#35473A] flex items-center justify-center font-mono text-xs font-bold text-[#C4F279] shrink-0">
                {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="text-left hidden 2xl:block">
                <div className="text-xs font-medium text-[#E6EFE5] leading-tight truncate max-w-[110px]">
                  {currentUser.name}
                </div>
                <div className="text-[10px] font-mono text-[#8EA490]">
                  {currentUser.role.replace(/_/g, ' ')} • {currentUser.bureau}
                </div>
              </div>
              <ChevronDown size={13} className="text-[#8EA490]" />
            </button>

            {/* Switch User Dropdown */}
            {showUserDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-[#1A241D] border border-[#35473A] shadow-2xl z-50 p-2">
                  <div className="px-3 py-2 border-b border-[#35473A] text-[11px] font-mono text-[#B8CBB9] flex items-center justify-between">
                    <span>Switch Active Persona (Demo Role):</span>
                    <span className="w-1.5 h-1.5 bg-[#C4F279]" />
                  </div>
                  <div className="space-y-1 mt-1">
                    {SYSTEM_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setCurrentUser(user);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                          currentUser.id === user.id
                            ? 'bg-[#222F25] text-[#C4F279] border border-[#35473A]'
                            : 'text-[#B8CBB9] hover:bg-[#222F25] hover:text-[#E6EFE5]'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-[#E6EFE5]">{user.name}</div>
                          <div className="text-[10px] text-[#8EA490]">
                            {user.role.replace(/_/g, ' ')} • Bureau: <span className="text-[#C4F279]">{user.bureau}</span>
                          </div>
                        </div>
                        {currentUser.id === user.id && (
                          <span className="w-1.5 h-1.5 bg-[#C4F279]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 mt-2 border-t border-[#35473A]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowLoginModal(true);
                      }}
                      className="w-full text-center py-1.5 px-2 bg-[#222F25] hover:bg-[#2D3F32] border border-[#35473A] text-xs font-mono text-[#C4F279] transition-colors"
                    >
                      Enter Official Credentials...
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Global Register Complaint Modal */}
      {showRegisterModal && (
        <RegisterComplaintModal
          isOpen={showRegisterModal}
          onClose={() => setShowRegisterModal(false)}
        />
      )}

      {/* Global Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
};
