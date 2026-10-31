import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  MenuIcon, 
  SearchIcon, 
  ChevronDownIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon
} from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function Topbar({ onToggleSidebar, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { environment, setEnvironment } = useThreat();
  const [showEnvMenu, setShowEnvMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const envRef = useRef(null);

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
      default:
        return 'ThreatLens';
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (envRef.current && !envRef.current.contains(e.target)) {
        setShowEnvMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/findings?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const environments = [
    'Production (AWS + K8s)',
    'Staging (us-west-2)',
    'Multi-Cloud Enclave'
  ];

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
        <div className="relative" ref={envRef}>
          <button
            onClick={() => setShowEnvMenu(!showEnvMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xs border border-[#e8dbe0] bg-white text-slate-700 hover:bg-[#f2e6eb]"
          >
            <span>{environment}</span>
            <ChevronDownIcon className="w-3 h-3 text-slate-400" />
          </button>

          {showEnvMenu && (
            <div className="absolute right-0 mt-1 w-52 bg-white border border-[#e8dbe0] rounded-xs py-1 z-50">
              {environments.map((env) => (
                <button
                  key={env}
                  onClick={() => {
                    setEnvironment(env);
                    setShowEnvMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    environment === env
                      ? 'bg-[#0f172a] text-white font-medium'
                      : 'text-slate-700 hover:bg-[#f2e6eb]'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-3 border-l border-[#e8dbe0]">
          <span className="text-slate-700 font-medium">Alex Rivera</span>
          <span className="text-[10px] text-slate-400 font-mono hidden md:inline">SecOps</span>
        </div>
      </div>
    </header>
  );
}
