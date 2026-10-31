import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useThreat } from '../context/ThreatContext';
import { StatCard } from '../components/common/StatCard';
import { SeverityDistribution } from '../components/dashboard/SeverityDistribution';
import { RiskTrendChart } from '../components/dashboard/RiskTrendChart';
import { RecentReportsTable } from '../components/dashboard/RecentReportsTable';
import { Button } from '../components/common/Button';
import { DownloadIcon } from '../components/common/Icons';

export function DashboardPage() {
  const { stats, showToast } = useThreat();
  const navigate = useNavigate();

  const handleExport = () => {
    showToast('Exporting executive vulnerability briefing (PDF)...', 'info');
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
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
        >
          Export Brief
        </Button>
      </div>

      {/* 4 Stat Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Findings"
          value={stats.totalFindings.toString()}
          subtext="6 audit archives indexed"
          onClick={() => navigate('/findings')}
        />

        <StatCard
          title="Critical Risks"
          value={stats.criticalRisks.toString()}
          subtext="Under 48h SLA required"
          change="Urgent"
          onClick={() => navigate('/findings?severity=Critical')}
        />

        <StatCard
          title="Unresolved Backlog"
          value={stats.unresolved.toString()}
          subtext={`${stats.resolved} verified resolved`}
          onClick={() => navigate('/findings?status=Open')}
        />

        <StatCard
          title="Remediation Progress"
          value={`${stats.remediationRate}%`}
          subtext={`${stats.resolved} of ${stats.totalFindings} findings closed`}
          onClick={() => navigate('/risk-analysis')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <SeverityDistribution />
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <RiskTrendChart />
        </div>
      </div>

      {/* Recent Ingested Reports */}
      <RecentReportsTable />
    </div>
  );
}
