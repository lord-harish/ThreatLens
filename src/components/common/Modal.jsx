import React, { useEffect } from 'react';
import { CloseIcon } from './Icons';

export function Modal({ isOpen, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg' }) {
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900/60"
          onClick={onClose}
        />

        <div className={`relative overflow-hidden rounded-xs enterprise-card p-4 text-left sm:my-8 w-full ${maxWidth}`}>
          <div className="flex items-start justify-between pb-3 border-b border-[#f0e3e7]">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-xs text-slate-500 hover:text-slate-900"
            >
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-3">
            {children}
          </div>

          {footer && (
            <div className="pt-3 border-t border-[#f0e3e7] flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
