import React, { useEffect } from 'react';
import { CloseIcon } from './Icons';

export function Drawer({ isOpen, onClose, title, subtitle, children, footer, width = 'max-w-2xl' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dim flat backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className={`w-screen ${width}`}>
          <div className="h-full flex flex-col bg-[#fefcfd] border-l border-[#decdd4] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#decdd4] bg-[#fbf7f8] flex items-start justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 font-sans">
                  {title}
                </div>
                {subtitle && (
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-[#f2e8ec]"
                aria-label="Close"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-3 border-t border-[#decdd4] bg-[#fbf7f8]">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
