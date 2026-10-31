import React from 'react';
import { RECURRING_VULNERABILITIES } from '../../data/mockRiskData';
import { SeverityBadge } from '../common/Badge';

export function RecurringVulnerabilities() {
  return (
    <div className="enterprise-card p-4 rounded-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Recurring Vulnerability Patterns
        </h3>
        <span className="text-[10px] font-mono text-slate-500">
          Cross-Quarter Correlation
        </span>
      </div>

      <div className="divide-y divide-[#f2e6eb]">
        {RECURRING_VULNERABILITIES.map((item) => (
          <div key={item.id} className="py-3 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-900">
                  {item.name}
                </span>
                <SeverityBadge severity={item.severity} size="xs" />
              </div>

              <div className="text-[10px] font-mono text-slate-500">
                Seen in {item.recurrenceCount} audits ({item.trend})
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] font-sans">
              <div className="text-slate-600">
                <span className="text-slate-400 font-mono text-[10px] block">Root Cause:</span>
                {item.rootCause}
              </div>
              <div className="text-slate-800">
                <span className="text-slate-400 font-mono text-[10px] block">Prescribed Fix:</span>
                {item.recommendation}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
