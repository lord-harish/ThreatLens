import React, { useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { DEPARTMENT_COMPARISON } from '../../data/mockRiskData';

export function DepartmentRiskComparison() {
  const [metric, setMetric] = useState('threatScore');

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#fefcfd] border border-[#decdd4] p-2.5 rounded-xs text-xs font-mono">
          <div className="font-bold text-slate-900 mb-1 pb-1 border-b border-[#f0e3e7]">
            {data.department}
          </div>
          <div className="text-[#9f1239]">Open Criticals: {data.openCritical}</div>
          <div className="text-[#b45309]">Open High: {data.openHigh}</div>
          <div className="text-[#0369a1]">Resolved Ratio: {data.resolvedPercent}%</div>
          <div className="text-slate-900 font-bold mt-1">Composite Threat Score: {data.threatScore}/100</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#f0e3e7]">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            Cross-Department Posture Benchmark
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Compare security density, critical exposure, and remediation velocity by operational division
          </p>
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          <button
            onClick={() => setMetric('threatScore')}
            className={`px-2 py-0.5 rounded-xs border transition-colors ${
              metric === 'threatScore'
                ? 'bg-[#0f172a] text-white border-[#0f172a] font-bold'
                : 'bg-[#fefcfd] text-slate-700 border-[#decdd4] hover:bg-[#f2e8ec]'
            }`}
          >
            Threat Score
          </button>
          <button
            onClick={() => setMetric('criticals')}
            className={`px-2 py-0.5 rounded-xs border transition-colors ${
              metric === 'criticals'
                ? 'bg-[#0f172a] text-white border-[#0f172a] font-bold'
                : 'bg-[#fefcfd] text-slate-700 border-[#decdd4] hover:bg-[#f2e8ec]'
            }`}
          >
            Criticals vs High
          </button>
        </div>
      </div>

      <div className="h-56 w-full my-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DEPARTMENT_COMPARISON} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#decdd4" />
            <XAxis 
              dataKey="department" 
              tickLine={false} 
              axisLine={{ stroke: '#decdd4' }}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={{ stroke: '#decdd4' }}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} 
            />
            <Tooltip content={<CustomTooltip />} />
            
            {metric === 'threatScore' ? (
              <Bar 
                dataKey="threatScore" 
                name="Threat Score" 
                fill="#9f1239" 
                radius={[2, 2, 0, 0]} 
              />
            ) : (
              <>
                <Bar 
                  dataKey="openCritical" 
                  name="Critical Risks" 
                  fill="#9f1239" 
                  radius={[2, 2, 0, 0]} 
                />
                <Bar 
                  dataKey="openHigh" 
                  name="High Risks" 
                  fill="#b45309" 
                  radius={[2, 2, 0, 0]} 
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-2 border-t border-[#f0e3e7] text-center font-mono text-[10px]">
        {DEPARTMENT_COMPARISON.map(d => (
          <div key={d.department} className="p-1 rounded-xs bg-[#fbf7f8] border border-[#f0e3e7]">
            <span className="text-slate-500 block truncate">{d.department}</span>
            <span className="font-bold text-slate-900 mt-0.5 block">{d.resolvedPercent}% Resolved</span>
          </div>
        ))}
      </div>
    </div>
  );
}
