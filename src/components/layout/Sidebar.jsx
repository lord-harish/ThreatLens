import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  ShieldIcon, 
  UploadIcon, 
  AlertIcon, 
  CpuIcon, 
  ChartIcon,
  TerminalIcon,
  SidebarCollapseIcon,
  SidebarExpandIcon
} from '../common/Icons';
import { LegalModal } from '../common/LegalModal';

export function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const [legalType, setLegalType] = useState(null);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: ShieldIcon, badge: null },
    { name: 'Upload Reports', path: '/upload', icon: UploadIcon, badge: null },
    { name: 'Audit Findings', path: '/findings', icon: AlertIcon, badge: null },
    { name: 'Risk Analysis', path: '/risk-analysis', icon: CpuIcon, badge: null },
    { name: 'Security Analytics', path: '/analytics', icon: ChartIcon, badge: null },
    { name: 'AI Assistant', path: '/ai-assistant', icon: TerminalIcon, badge: null }
  ];

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 z-40
        bg-[#faf5f7] border-r border-[#e8dbe0]
        flex flex-col transition-all duration-200
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isCollapsed ? 'lg:w-16' : 'lg:w-60 w-60'}
      `}>
        {/* Brand Header with Expand/Compress Button */}
        <div className={`h-14 px-3 flex items-center border-b border-[#e8dbe0] ${
          isCollapsed ? 'justify-center' : 'justify-between px-4'
        }`}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-xs bg-[#0f172a]" />
                <span className="text-sm font-semibold tracking-tight text-slate-900 font-sans">
                  ThreatLens
                </span>
                <span className="text-[10px] font-mono text-slate-400">v1.0</span>
              </div>
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1 rounded-xs text-slate-400 hover:text-slate-900 hover:bg-[#f2e6eb]"
                title="Compress Navigation"
                aria-label="Compress Navigation"
              >
                <SidebarCollapseIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-[#f2e6eb]"
              title="Expand Navigation"
              aria-label="Expand Navigation"
            >
              <SidebarExpandIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Minimal Navigation Items */}
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                title={isCollapsed ? item.name : undefined}
                className={`
                  flex items-center rounded-xs text-xs transition-colors
                  ${isCollapsed 
                    ? 'justify-center px-2 py-2.5' 
                    : 'justify-between px-3 py-2'
                  }
                  ${isActive 
                    ? 'bg-[#0f172a] text-white font-medium' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-[#f2e6eb]'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>{item.name}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-mono ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-[#e8dbe0] text-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {isCollapsed && item.badge && (
                  <span className="sr-only">({item.badge})</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Minimal Footer */}
        <div className={`p-3 border-t border-[#e8dbe0] flex items-center text-[11px] text-slate-500 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          {!isCollapsed ? (
            <>
              <button
                onClick={() => setLegalType('tos')}
                className="hover:text-slate-900"
              >
                Terms
              </button>
              <span>·</span>
              <button
                onClick={() => setLegalType('privacy')}
                className="hover:text-slate-900"
              >
                Privacy
              </button>
              <span>·</span>
              <span className="font-mono text-[10px] text-slate-400">AI</span>
            </>
          ) : (
            <button
              onClick={() => setLegalType('tos')}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-900"
              title="Terms & Privacy"
            >
              AI
            </button>
          )}
        </div>
      </aside>

      <LegalModal
        isOpen={Boolean(legalType)}
        type={legalType}
        onClose={() => setLegalType(null)}
      />
    </>
  );
}
