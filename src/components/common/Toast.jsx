import React from 'react';
import { CloseIcon, AlertIcon, CheckIcon } from './Icons';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const borders = {
    success: 'border-[#a7f3d0] bg-[#f0fdf4] text-[#047857]',
    error: 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]',
    info: 'border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]'
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className={`p-3 rounded-xs border text-xs flex items-center gap-2 ${borders[toast.type] || borders.info}`}>
        {toast.type === 'error' ? (
          <AlertIcon className="w-4 h-4 shrink-0" />
        ) : (
          <CheckIcon className="w-4 h-4 shrink-0" />
        )}
        <div className="font-mono flex-1 leading-snug">
          {toast.message}
        </div>
        <button
          onClick={onClose}
          className="text-current opacity-70 hover:opacity-100 p-0.5"
          aria-label="Dismiss"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
