import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppLayout: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#101713] text-[#E6EFE5] bg-pixel-grid font-sans">
      {/* Sidebar Navigation (with responsive drawer state for mobile/tablet) */}
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={() => setIsMobileSidebarOpen(false)} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <Topbar 
          onToggleSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)} 
        />
        
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 min-h-0 min-w-0 w-full bg-[#000000]/70">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
