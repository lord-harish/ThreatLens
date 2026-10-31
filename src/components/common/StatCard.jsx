import React from 'react';

export function StatCard({
  title,
  value,
  subtext,
  change,
  onClick
}) {
  return (
    <div
      onClick={onClick}
      className={`enterprise-card p-4 rounded-xs ${onClick ? 'cursor-pointer hover:bg-[#fcf8fa]' : ''}`}
    >
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-medium mb-1">
        {title}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
          {value}
        </div>
        {change && (
          <span className="text-[10px] font-mono text-slate-500">
            {change}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-2 pt-2 border-t border-[#f2e6eb] text-[11px] text-slate-500 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
}
