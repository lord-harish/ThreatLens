import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  MenuIcon, 
  SearchIcon, 
  SidebarCollapseIcon,
  SidebarExpandIcon
} from '../common/Icons';

export function Topbar({ onToggleSidebar, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Dashboard';
      case '/upload':
        return 'Upload Reports';
      case '/findings':
        return 'Audit Findings';
      case '/risk-analysis':
        return 'Risk Analysis';
      case '/ai-assistant':
        return 'AI Assistant';
      case '/analytics':
        return 'Security Analytics';
      default:
        return 'ThreatLens';
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/findings?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#faf5f7] border-b border-[#e8dbe0] px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Expand/Compress Button + Title */}
      <div className="flex items-center gap-2.5">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-1 rounded-xs text-slate-600 hover:text-slate-900"
          aria-label="Toggle navigation drawer"
        >
          <MenuIcon className="w-4 h-4" />
        </button>

        {/* Desktop Expand / Compress Navbar Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex items-center justify-center p-1.5 rounded-xs border border-[#e8dbe0] bg-white text-slate-700 hover:text-slate-900 hover:bg-[#f2e6eb] transition-colors"
          title={isCollapsed ? "Expand Navigation Bar" : "Compress Navigation Bar"}
          aria-label={isCollapsed ? "Expand Navigation Bar" : "Compress Navigation Bar"}
        >
          {isCollapsed ? (
            <SidebarExpandIcon className="w-4 h-4" />
          ) : (
            <SidebarCollapseIcon className="w-4 h-4" />
          )}
        </button>

        <h1 className="text-sm font-semibold text-slate-900 font-sans ml-1">
          {getPageTitle()}
        </h1>
      </div>

      {/* Center Search */}
      <div className="hidden sm:flex items-center flex-1 max-w-xs mx-6">
        <form onSubmit={handleSearch} className="w-full relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search CVE or asset..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1 text-xs enterprise-input rounded-xs font-mono"
          />
        </form>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 text-xs">
        <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
          ThreatLens AI
        </span>
      </div>
    </header>
  );
}
