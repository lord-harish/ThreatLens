import React from 'react';

export function SeverityBadge({ severity, size = 'sm', className = '' }) {
  const styles = {
    Critical: 'bg-[#ffe4e6] text-[#9f1239] border-[#fecdd3]',
    High: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]',
    Medium: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]',
    Low: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
    Info: 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
  };

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.2 font-mono uppercase font-semibold',
    sm: 'text-[11px] px-2 py-0.5 font-mono uppercase font-semibold',
    md: 'text-xs px-2.5 py-1 font-mono uppercase font-semibold'
  };

  const currentStyle = styles[severity] || styles.Info;

  return (
    <span className={`inline-flex items-center rounded-xs border ${currentStyle} ${sizeClasses[size]} ${className}`}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status, size = 'sm', className = '' }) {
  const styles = {
    Open: 'bg-[#ffe4e6] text-[#9f1239] border-[#fecdd3]',
    'In Progress': 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]',
    Resolved: 'bg-[#d1fae5] text-[#047857] border-[#a7f3d0]',
    'Risk Accepted': 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
  };

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.2 font-mono uppercase font-medium',
    sm: 'text-[11px] px-2 py-0.5 font-mono uppercase font-medium',
    md: 'text-xs px-2.5 py-1 font-mono uppercase font-medium'
  };

  return (
    <span className={`inline-flex items-center rounded-xs border ${styles[status] || styles.Open} ${sizeClasses[size]} ${className}`}>
      {status}
    </span>
  );
}

export function ComplianceTag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-xs text-[10px] font-mono border border-[#decdd4] bg-[#fbf7f8] text-[#334155] ${className}`}>
      {children}
    </span>
  );
}
