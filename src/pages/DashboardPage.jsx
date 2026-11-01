import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAnalyticsOverview, fetchAnalyticsStatus, fetchFindings } from '../api/documents';
import { useThreat } from '../context/ThreatContext';
import { StatCard } from '../components/common/StatCard';
import { SeverityDistribution } from '../components/dashboard/SeverityDistribution';
import { RiskTrendChart } from '../components/dashboard/RiskTrendChart';
import { RecentReportsTable } from '../components/dashboard/RecentReportsTable';
import { Button } from '../components/common/Button';
import { DownloadIcon } from '../components/common/Icons';

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function DashboardPage() {
  const { showToast } = useThreat();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([fetchAnalyticsOverview(), fetchAnalyticsStatus()])
      .then(([summary, statusData]) => {
        if (!active) return;
        setOverview(summary);
        setStatuses(statusData);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const stats = useMemo(() => {
    const counts = Object.fromEntries(statuses.map((item) => [item.name, item.count]));
    const resolved = counts.Resolved ?? 0;
    return {
      unresolved: (counts.Open ?? 0) + (counts['In Progress'] ?? 0),
      resolved,
    };
  }, [statuses]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const findings = await fetchFindings({ limit: 500 });
      const headers = [
        'Finding ID', 'Title', 'Severity', 'Status', 'Category', 'Affected asset',
        'CVSS', 'Source document', 'Source page', 'Evidence',
      ];
      const rows = findings.map((finding) => [
        finding.id,
        finding.title,
        finding.severity,
        finding.status,
        finding.category,
        finding.affected_asset,
        finding.cvss_score,
        finding.original_filename,
        finding.page_number,
        finding.evidence_excerpt,
      ].map(csvCell).join(','));
      const content = [headers.map(csvCell).join(','), ...rows].join('\r\n');
      const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `threatlens-findings-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${findings.length} persisted finding(s).`, 'success');
    } catch (requestError) {
      showToast(requestError.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[#e8dbe0]">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
            Vulnerability Posture
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={DownloadIcon}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Export Findings CSV'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          Could not load dashboard data: {error}
          <button type="button" className="ml-2 underline" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Audit Reports"
          value={loading ? '—' : String(overview?.total_reports ?? 0)}
          subtext="Uploaded documents"
          onClick={() => navigate('/upload')}
        />
        <StatCard
          title="Total Findings"
          value={loading ? '—' : String(overview?.total_findings ?? 0)}
          subtext="Persisted, non-rejected findings"
          onClick={() => navigate('/findings')}
        />
        <StatCard
          title="Critical Findings"
          value={loading ? '—' : String(overview?.critical_findings ?? 0)}
          subtext="Source-linked findings"
          change="Critical"
          onClick={() => navigate('/findings?severity=Critical')}
        />
        <StatCard
          title="Unresolved Findings"
          value={loading ? '—' : String(stats.unresolved)}
          subtext={loading ? 'Loading status totals…' : `${stats.resolved} resolved`}
          onClick={() => navigate('/findings?status=Open')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <SeverityDistribution />
        </div>
        <div className="lg:col-span-7 flex flex-col">
          <RiskTrendChart />
        </div>
      </div>

      <RecentReportsTable />
    </div>
  );
}
