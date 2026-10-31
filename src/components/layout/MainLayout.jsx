import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { FindingDetailDrawer } from '../findings/FindingDetailDrawer';
import { Toast } from '../common/Toast';
import { useThreat } from '../../context/ThreatContext';

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('threatlens_nav_collapsed') === 'true';
  });
  const { toast, setToast } = useThreat();

  const handleToggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('threatlens_nav_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#faf5f7] text-slate-900 flex flex-col font-sans">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${
        isCollapsed ? 'lg:pl-16' : 'lg:pl-60'
      }`}>
        <Topbar 
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <FindingDetailDrawer />

      {toast && <Toast toast={toast} onClose={() => setToast && setToast(null)} />}
    </div>
  );
}
