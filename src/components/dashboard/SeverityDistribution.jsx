import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { fetchAnalyticsSeverity } from '../../api/documents';

export function SeverityDistribution() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const colors = {
    Critical: '#9f1239',
    High: '#b45309',
    Medium: '#ca8a04',
    Low: '#0369a1',
    Informational: '#64748b',
  };

  useEffect(() => {
    let active = true;
    fetchAnalyticsSeverity()
      .then((response) => {
        if (active) setRecords(response);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const data = useMemo(
    () => records.map((item) => ({
      name: item.name,
      value: item.count,
      color: colors[item.name] || '#64748b',
    })),
    [records]
  );

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
            {data.find((item) => item.name === 'Critical')?.value ?? '—'}
          </span>
          <span className="text-[10px] font-mono text-[#9f1239] uppercase">
            Critical
          </span>
        </div>
      </div>

      {loading && (
        <p className="py-2 text-center text-xs text-slate-500">Loading severity data…</p>
      )}
      {error && (
        <p role="alert" className="py-2 text-center text-xs text-[#9f1239]">{error}</p>
      )}
      {!loading && !error && total === 0 && (
        <p className="py-2 text-center text-xs text-slate-500">No persisted findings yet.</p>
      )}

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
