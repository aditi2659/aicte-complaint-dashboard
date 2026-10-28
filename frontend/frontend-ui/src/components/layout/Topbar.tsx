import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  PlusCircle,
  ChevronDown,
  GitMerge,
  Search,
  ExternalLink,
  Menu,
  LogOut
} from 'lucide-react';
import { useComplaints } from '../../context/ComplaintContext';
import { useAuth } from '../../context/AuthContext';
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
  const { user: authUser, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const unreviewedOverlaps = overlaps.filter(o => o.reviewStatus === 'UNREVIEWED');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/complaints?search=${encodeURIComponent(quickSearch.trim())}`);
      setQuickSearch('');
    }
  };

  return (
    <>
      <header className="h-16 border-b border-[#292929] bg-[#000000] px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
        {/* Left: Mobile Menu Trigger + Breadcrumb */}
        <div className="flex items-center gap-4">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-2 text-[#B5B5B5] hover:text-[#F5F5F5] hover:bg-[#1A1A1A] transition-colors"
              aria-label="Toggle Navigation"
            >
              <Menu size={18} />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#B5B5B5]">
            <span className="text-[#FF69B4] font-bold">AICTE</span>
            <span>/</span>
            <span className="uppercase tracking-wider">
              {location.pathname === '/' ? 'DASHBOARD' : location.pathname.replace('/', '').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center: Quick Search */}
        <div className="flex-1 max-w-md hidden md:block">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B5B5B5]" size={14} />
            <input
              type="text"
              placeholder="Quick search by Case #, Institute or Keyword..."
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#292929] pl-9 pr-4 py-1.5 text-xs text-[#F5F5F5] placeholder-[#B5B5B5] focus:outline-none focus:border-[#C4F279] transition-colors font-mono"
            />
          </form>
        </div>

        {/* Right: Actions & User Menu */}
        <div className="flex items-center gap-3">
          {/* Overlap alert button if any pending */}
          {unreviewedOverlaps.length > 0 && (
            <button
              onClick={() => navigate('/overlaps')}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#FF69B4]/10 border border-[#FF69B4] text-[#FF69B4] hover:bg-[#FF69B4]/20 transition-colors text-xs font-mono animate-pulse"
              title={`${unreviewedOverlaps.length} overlaps require review`}
            >
              <GitMerge size={14} />
              <span className="hidden sm:inline font-bold">OVERLAPS</span>
              <span className="bg-[#FF69B4] text-black text-[10px] px-1.5 py-0.2 font-black rounded-sm">
                {unreviewedOverlaps.length}
              </span>
            </button>
          )}

          {/* Register New Complaint Button */}
          <button
            onClick={() => setShowRegisterModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#C4F279] text-black hover:bg-[#A8E05F] transition-colors text-xs font-bold font-mono tracking-wider shadow-[0_0_10px_rgba(196,242,121,0.2)]"
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">REGISTER CASE</span>
            <span className="sm:hidden">NEW</span>
          </button>

          {/* User Role Selector */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#0D0D0D] border border-[#292929] hover:border-[#333333] transition-colors text-left"
            >
              <div className="w-2 h-2 rounded-full bg-[#C4F279]" />
              <div className="hidden lg:block">
                <div className="text-[11px] font-bold text-[#F5F5F5] leading-tight">
                  {authUser?.name || currentUser.name}
                </div>
                <div className="text-[9px] font-mono text-[#B5B5B5] tracking-wider">
                  {authUser?.role || currentUser.role}
                </div>
              </div>
              <ChevronDown size={12} className="text-[#B5B5B5]" />
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
                    <span>ACTIVE OPERATOR</span>
                    <span className="text-[9px] text-[#A8E05F]">SWITCH ROLE</span>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {SYSTEM_USERS.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setCurrentUser(user);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex flex-col gap-0.5 ${
                          currentUser.id === user.id
                            ? 'bg-[#2D3F32] text-[#C4F279] border-l-2 border-[#C4F279]'
                            : 'text-[#E5EFE6] hover:bg-[#222F25]'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{user.name}</span>
                          <span className="text-[9px] font-mono px-1 bg-[#121A14] text-[#B8CBB9] border border-[#35473A]">
                            {user.bureau}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8EA291] font-mono">
                          {user.role}
                        </div>
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

                  {/* Logout button */}
                  {authUser && (
                    <div className="mt-2 pt-2 border-t border-[#35473A]">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <LogOut size={13} />
                        <span>Sign Out</span>
                        {authUser.email && (
                          <span className="ml-auto text-[10px] font-mono text-[#666] truncate max-w-[120px]">{authUser.email}</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Complaint Registration Modal */}
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
