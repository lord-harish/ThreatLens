import React from 'react';
import { PRIORITY_FINDINGS } from '../../data/mockRiskData';
import { useThreat } from '../../context/ThreatContext';

export function PriorityFindingsList() {
  const { findings, setActiveFinding } = useThreat();

  const handleInspect = (cve) => {
    const match = findings.find(f => f.cve === cve) || findings[0];
    setActiveFinding(match);
  };

  return (
    <div className="enterprise-card p-4 rounded-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Priority Attack Paths
        </h3>
        <span className="text-[10px] font-mono text-[#9f1239] font-medium">
          Top 4 Critical Findings
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {PRIORITY_FINDINGS.map((item) => (
          <div
            key={item.cve}
            onClick={() => handleInspect(item.cve)}
            className="p-3 rounded-xs enterprise-panel-subtle cursor-pointer hover:bg-[#fcf8fa] transition-colors flex flex-col justify-between space-y-2 border border-[#e8dbe0]"
          >
            <div>
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">#{item.rank}</span>
                  <span className="text-[#9f1239] font-semibold">{item.cve}</span>
                  <span className="text-slate-400">· CVSS {item.cvss}</span>
                </div>
                <span className="text-[10px] font-semibold text-[#9f1239] uppercase">
                  {item.severity}
                </span>
              </div>

              <div className="text-xs font-medium text-slate-900 mt-1">
                {item.title}
              </div>

              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                {item.businessImpact}
              </p>
            </div>

            <div className="pt-2 border-t border-[#f2e6eb] text-[10px] font-mono text-slate-500 flex justify-between">
              <span className="truncate max-w-[200px]">{item.asset}</span>
              <span className="text-slate-700">{item.remediationEffort}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
