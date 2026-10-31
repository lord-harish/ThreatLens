import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useThreat } from '../../context/ThreatContext';

export function SeverityDistribution() {
  const { findings } = useThreat();

  const data = React.useMemo(() => {
    const counts = { Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0 };
    findings.forEach(f => {
      if (counts[f.severity] !== undefined) {
        counts[f.severity]++;
      } else {
        counts.Info++;
      }
    });

    return [
      { name: "Critical", value: counts.Critical, color: "#9f1239" },
      { name: "High", value: counts.High, color: "#b45309" },
      { name: "Medium", value: counts.Medium, color: "#ca8a04" },
      { name: "Low", value: counts.Low, color: "#0369a1" },
      { name: "Info", value: counts.Info, color: "#64748b" },
    ];
  }, [findings]);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
      return (
        <div className="bg-white border border-[#e8dbe0] p-2 rounded-xs text-xs font-mono">
          <span className="font-semibold">{item.name}:</span> {item.value} ({pct}%)
        </div>
      );
    }
    return null;
  };

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Severity Breakdown
        </h3>
        <span className="text-xs font-mono text-slate-500">
          {total} total
        </span>
      </div>

      <div className="relative h-52 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="#ffffff"
              strokeWidth={1}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold font-mono text-slate-900">
            {data[0]?.value || 0}
          </span>
          <span className="text-[10px] font-mono text-[#9f1239] uppercase">
            Critical
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1 pt-2 border-t border-[#f2e6eb] text-center font-mono text-[10px]">
        {data.map((item) => (
          <div key={item.name} className="py-1">
            <div className="text-slate-400">{item.name}</div>
            <div className="font-semibold text-slate-800 mt-0.5">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
