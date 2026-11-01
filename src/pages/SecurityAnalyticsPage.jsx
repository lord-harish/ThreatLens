import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchAnalyticsCategories,
  fetchAnalyticsOverview,
  fetchAnalyticsRiskDistribution,
  fetchAnalyticsSeverity,
  fetchAnalyticsStatus,
  fetchAnalyticsTopPriorities,
} from '../api/documents';
import { SeverityBadge, StatusBadge } from '../components/common/Badge';

const CHART_COLORS = {
  Critical: '#9f1239',
  High: '#b45309',
  Medium: '#ca8a04',
  Low: '#0369a1',
  Informational: '#64748b',
  'Critical Risk': '#9f1239',
  'High Risk': '#b45309',
  'Medium Risk': '#ca8a04',
  'Low Risk': '#0369a1',
  Open: '#9f1239',
  'In Progress': '#0369a1',
  Resolved: '#047857',
  'Accepted Risk': '#64748b',
  'Access Control': '#7c3aed',
  'Network Security': '#0369a1',
  'Vulnerability Management': '#b45309',
  'Data Protection': '#0891b2',
  'Cloud Security': '#4f46e5',
  'Incident Response': '#047857',
  Other: '#64748b',
};

function AnalyticsChart({ title, data, emptyMessage }) {
  const hasData = data.some((item) => item.count > 0);

  return (
    <section className="enterprise-card min-w-0 p-3">
      <h3 className="mb-2 border-b border-[#f2e6eb] pb-2 text-xs font-mono font-bold uppercase text-slate-800">
        {title}
      </h3>
      {hasData ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid stroke="#eee2e7" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={136}
                tick={{ fontSize: 10 }}
              />
              <Tooltip
                formatter={(value) => [value, 'Findings']}
                contentStyle={{ borderColor: '#decdd4', fontSize: 11 }}
              />
              <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                {data.map((item) => (
                  <Cell key={item.name} fill={CHART_COLORS[item.name] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center px-4 text-center text-xs text-slate-500">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <section className="enterprise-card p-3">
      <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
    </section>
  );
}

export function SecurityAnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        overview,
        severity,
        status,
        riskDistribution,
        categories,
        priorities,
      ] = await Promise.all([
        fetchAnalyticsOverview(),
        fetchAnalyticsSeverity(),
        fetchAnalyticsStatus(),
        fetchAnalyticsRiskDistribution(),
        fetchAnalyticsCategories(),
        fetchAnalyticsTopPriorities(),
      ]);
      setData({ overview, severity, status, riskDistribution, categories, priorities });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [revision]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const openFinding = (findingId) => {
    navigate(`/findings?finding_id=${encodeURIComponent(findingId)}`);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8dbe0] pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900 font-mono">
            Security Analytics
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Understand your audit findings and security risk posture.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
          className="border border-[#decdd4] bg-[#fbf7f8] px-3 py-1.5 text-xs font-mono text-slate-800 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh analytics'}
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => setRevision((value) => value + 1)} className="shrink-0 underline">
            Retry
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="enterprise-card p-6 text-center text-xs text-slate-500" role="status">
          Loading security analytics…
        </div>
      ) : data && (
        <>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Audit reports" value={data.overview.total_reports} />
            <MetricCard label="Security findings" value={data.overview.total_findings} />
            <MetricCard label="Critical findings" value={data.overview.critical_findings} />
            <MetricCard label="High risk" value={data.overview.high_risk_findings} />
            <MetricCard label="Open" value={data.overview.open_findings} />
            <MetricCard label="Resolved" value={data.overview.resolved_findings} />
          </section>

          <section className="grid gap-3 md:grid-cols-2" aria-label="Finding analytics charts">
            <AnalyticsChart
              title="Findings by severity"
              data={data.severity}
              emptyMessage="No findings are available for this chart."
            />
            <AnalyticsChart
              title="Findings by status"
              data={data.status}
              emptyMessage="No findings are available for this chart."
            />
            <AnalyticsChart
              title="Risk distribution"
              data={data.riskDistribution}
              emptyMessage="Risk distribution appears after findings have Step 6 scores."
            />
            <AnalyticsChart
              title="Findings by category"
              data={data.categories}
              emptyMessage="No findings are available for this chart."
            />
          </section>

          <section className="enterprise-card overflow-hidden">
            <div className="border-b border-[#f2e6eb] p-3">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-800">
                Highest-priority findings
              </h3>
              <p className="mt-1 text-[10px] text-slate-500">
                Ranked by the persisted Step 6 contextual risk score.
              </p>
            </div>
            {data.priorities.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">
                No scored findings yet. Analyze an uploaded report to create findings and risk scores.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8dbe0] bg-[#faf5f7] text-[10px] font-mono uppercase text-slate-500">
                      <th className="px-3 py-2 font-medium">Finding ID</th>
                      <th className="px-3 py-2 font-medium">Finding title</th>
                      <th className="px-3 py-2 font-medium">Severity</th>
                      <th className="px-3 py-2 font-medium">Risk score</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Affected asset</th>
                      <th className="px-3 py-2 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2e6eb]">
                    {data.priorities.map((finding) => (
                      <tr
                        key={finding.id}
                        onClick={() => openFinding(finding.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openFinding(finding.id);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                        aria-label={`Open finding ${finding.id}: ${finding.title}`}
                        className="cursor-pointer hover:bg-[#fcf8fa] focus:bg-[#fcf8fa] focus:outline-none"
                      >
                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500">{finding.id}</td>
                        <td className="max-w-64 px-3 py-2">
                          <span className="line-clamp-2 font-medium text-slate-900">{finding.title}</span>
                          <span className="mt-1 block text-[10px] text-slate-500">{finding.original_filename}</span>
                        </td>
                        <td className="px-3 py-2"><SeverityBadge severity={finding.severity} size="xs" /></td>
                        <td className="px-3 py-2 font-mono font-semibold">
                          {typeof finding.risk_score === 'number' ? finding.risk_score.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 py-2"><StatusBadge status={finding.status} size="xs" /></td>
                        <td className="px-3 py-2 text-slate-600">{finding.affected_asset || 'Not specified'}</td>
                        <td className="px-3 py-2">
                          {finding.evidence_available
                            ? <span className="text-emerald-700">Available</span>
                            : <span className="text-slate-500">Unavailable</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
