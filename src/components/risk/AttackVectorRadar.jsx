import React from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { ATTACK_VECTOR_RADAR } from '../../data/mockRiskData';

export function AttackVectorRadar() {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#fefcfd] border border-[#decdd4] p-2.5 rounded-xs text-xs font-mono">
          <div className="font-bold text-slate-900 mb-1 pb-1 border-b border-[#f0e3e7]">
            {data.subject}
          </div>
          <div className="text-[#9f1239]">Environment Risk: {data.currentRisk} / 100</div>
          <div className="text-[#0369a1]">Industry Peer Baseline: {data.benchmark} / 100</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#f0e3e7]">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
            Perimeter Exposure Radar
          </h3>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">
            Vector analysis vs peer benchmark data
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-700 bg-[#f2e8ec] px-1.5 py-0.5 rounded-xs border border-[#decdd4]">
          6 VECTORS SCOPED
        </span>
      </div>

      <div className="h-64 w-full my-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={ATTACK_VECTOR_RADAR}>
            <PolarGrid stroke="#decdd4" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#334155', fontSize: 10, fontFamily: 'monospace' }} 
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Active Environment"
              dataKey="currentRisk"
              stroke="#9f1239"
              fill="#ffe4e6"
              fillOpacity={0.6}
            />
            <Radar
              name="Industry Baseline"
              dataKey="benchmark"
              stroke="#0369a1"
              fill="#e0f2fe"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 pt-2 border-t border-[#f0e3e7] text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#ffe4e6] border border-[#9f1239] rounded-xs" />
          <span className="text-slate-900">Subscribed Infrastructure</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-[#e0f2fe] border border-[#0369a1] rounded-xs" />
          <span className="text-slate-600">PwC Industry Median</span>
        </div>
      </div>
    </div>
  );
}
