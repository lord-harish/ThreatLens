import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchAnalyticsRiskDistribution } from '../../api/documents';

export function RiskTrendChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchAnalyticsRiskDistribution()
      .then((response) => {
        if (active) setData(response);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="enterprise-card p-4 rounded-xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Contextual Risk Distribution
        </h3>
        <span className="text-[10px] font-mono text-slate-500">Persisted scores</span>
      </div>

      <div className="h-52 w-full my-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Loading risk scores…
          </div>
        ) : error ? (
          <div role="alert" className="flex h-full items-center justify-center text-xs text-[#9f1239]">
            {error}
          </div>
        ) : !data.some((item) => item.count > 0) ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No persisted risk scores yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e8dbe0" />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: '#e8dbe0' }}
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={{ stroke: '#e8dbe0' }}
                tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} />
              <Tooltip />
              <Bar dataKey="count" name="Findings" fill="#0369a1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-[#f2e6eb]">
        <span>Risk class</span>
        <span className="text-slate-400">Based on saved risk scores</span>
      </div>
    </div>
  );
}
