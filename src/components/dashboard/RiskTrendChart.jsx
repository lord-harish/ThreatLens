import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { RISK_TREND_DATA } from '../../data/mockRiskData';

export function RiskTrendChart() {
  const [timeRange, setTimeRange] = useState('6M');

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#e8dbe0] p-2.5 rounded-xs text-xs font-mono space-y-1">
          <div className="font-semibold text-slate-900 border-b border-[#f2e6eb] pb-0.5">
            {label}
          </div>
          <div className="flex justify-between gap-4 text-[#9f1239]">
            <span>Critical:</span>
            <span className="font-bold">{payload.find(p => p.dataKey === 'critical')?.value}</span>
          </div>
          <div className="flex justify-between gap-4 text-[#b45309]">
            <span>High:</span>
            <span className="font-bold">{payload.find(p => p.dataKey === 'high')?.value}</span>
          </div>
          <div className="flex justify-between gap-4 text-[#047857]">
            <span>Resolved:</span>
            <span className="font-bold">{payload.find(p => p.dataKey === 'resolved')?.value}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Remediation Trend
        </h3>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          {['30D', '6M', 'YTD'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 rounded-xs border transition-colors ${
                timeRange === range
                  ? 'bg-[#0f172a] text-white border-[#0f172a]'
                  : 'bg-white text-slate-600 border-[#e8dbe0] hover:bg-[#f2e6eb]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="h-52 w-full my-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={RISK_TREND_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e8dbe0" />
            <XAxis 
              dataKey="month" 
              tickLine={false} 
              axisLine={{ stroke: '#e8dbe0' }}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={{ stroke: '#e8dbe0' }}
              tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} 
            />
            <Tooltip content={<CustomTooltip />} />

            <Area 
              type="linear" 
              dataKey="resolved" 
              stroke="#047857" 
              strokeWidth={1.5}
              fill="#d1fae5" 
              fillOpacity={0.5} 
            />
            <Area 
              type="linear" 
              dataKey="high" 
              stroke="#b45309" 
              strokeWidth={1.5}
              fill="#ffedd5" 
              fillOpacity={0.5} 
            />
            <Area 
              type="linear" 
              dataKey="critical" 
              stroke="#9f1239" 
              strokeWidth={1.5}
              fill="#ffe4e6" 
              fillOpacity={0.6} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-[#f2e6eb]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#9f1239] rounded-xs" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#b45309] rounded-xs" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-[#047857] rounded-xs" />
            <span>Resolved</span>
          </div>
        </div>

        <span className="text-slate-400">
          Monthly Cycles
        </span>
      </div>
    </div>
  );
}
