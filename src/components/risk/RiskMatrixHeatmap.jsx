import React from 'react';
import { AlertIcon } from '../common/Icons';

export function RiskMatrixHeatmap() {
  const impacts = ['Catastrophic', 'Major', 'Moderate', 'Minor', 'Insignificant'];
  const likelihoods = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];

  const matrixData = {
    'Almost Certain': { Catastrophic: { count: 2, level: 'Extreme', bg: 'bg-[#ffe4e6] text-[#9f1239] border-[#fecdd3]' }, Major: { count: 4, level: 'High', bg: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]' }, Moderate: { count: 3, level: 'High', bg: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]' }, Minor: { count: 2, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Insignificant: { count: 1, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' } },
    'Likely': { Catastrophic: { count: 3, level: 'Extreme', bg: 'bg-[#ffe4e6] text-[#9f1239] border-[#fecdd3]' }, Major: { count: 7, level: 'High', bg: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]' }, Moderate: { count: 8, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Minor: { count: 4, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Insignificant: { count: 2, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' } },
    'Possible': { Catastrophic: { count: 1, level: 'High', bg: 'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]' }, Major: { count: 5, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Moderate: { count: 18, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Minor: { count: 9, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' }, Insignificant: { count: 4, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' } },
    'Unlikely': { Catastrophic: { count: 0, level: 'Medium', bg: 'bg-[#fbf7f8] text-slate-400 border-[#decdd4]' }, Major: { count: 2, level: 'Medium', bg: 'bg-[#fef9c3] text-[#854d0e] border-[#fde047]' }, Moderate: { count: 6, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' }, Minor: { count: 24, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' }, Insignificant: { count: 8, level: 'Minimal', bg: 'bg-[#d1fae5] text-[#047857] border-[#a7f3d0]' } },
    'Rare': { Catastrophic: { count: 0, level: 'Low', bg: 'bg-[#fbf7f8] text-slate-400 border-[#decdd4]' }, Major: { count: 1, level: 'Low', bg: 'bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]' }, Moderate: { count: 3, level: 'Minimal', bg: 'bg-[#d1fae5] text-[#047857] border-[#a7f3d0]' }, Minor: { count: 7, level: 'Minimal', bg: 'bg-[#d1fae5] text-[#047857] border-[#a7f3d0]' }, Insignificant: { count: 12, level: 'Minimal', bg: 'bg-[#d1fae5] text-[#047857] border-[#a7f3d0]' } }
  };

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#f0e3e7]">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <AlertIcon className="w-4 h-4 text-[#9f1239]" />
            5×5 Risk Heatmap Matrix
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Exploitation likelihood correlated with organizational business impact
          </p>
        </div>
        <span className="text-[10px] font-mono font-bold text-[#9f1239] bg-[#ffe4e6] px-1.5 py-0.5 rounded-xs border border-[#fecdd3]">
          5 CRITICAL CLUSTERS
        </span>
      </div>

      <div className="overflow-x-auto my-2">
        <div className="min-w-[420px]">
          {/* Header Row */}
          <div className="grid grid-cols-6 gap-1 text-center font-mono text-[9px] text-slate-500 font-bold mb-1">
            <div className="text-left pl-1">Likelihood \ Impact</div>
            {impacts.map(imp => (
              <div key={imp} className="truncate px-1" title={imp}>
                {imp.slice(0, 5)}..
              </div>
            ))}
          </div>

          {/* Rows */}
          {likelihoods.map(l => (
            <div key={l} className="grid grid-cols-6 gap-1 mb-1">
              <div className="text-left font-mono text-[10px] text-slate-700 font-medium py-2 truncate" title={l}>
                {l}
              </div>
              {impacts.map(imp => {
                const cell = matrixData[l][imp];
                return (
                  <div
                    key={`${l}-${imp}`}
                    className={`h-8 rounded-xs border flex items-center justify-center font-mono text-xs font-bold ${cell.bg}`}
                    title={`${l} x ${imp}: ${cell.count} findings`}
                  >
                    {cell.count > 0 ? cell.count : '-'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between pt-2 border-t border-[#f0e3e7] text-[10px] font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-[#ffe4e6] border border-[#fecdd3] rounded-xs" />
            <span>Extreme</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-[#ffedd5] border border-[#fed7aa] rounded-xs" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-[#fef9c3] border border-[#fde047] rounded-xs" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-[#e0f2fe] border border-[#bae6fd] rounded-xs" />
            <span>Low</span>
          </div>
        </div>

        <span className="text-slate-400">
          NIST SP 800-30 Guide
        </span>
      </div>
    </div>
  );
}
