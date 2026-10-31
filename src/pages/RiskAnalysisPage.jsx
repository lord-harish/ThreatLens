import React from 'react';
import { AttackVectorRadar } from '../components/risk/AttackVectorRadar';
import { RiskMatrixHeatmap } from '../components/risk/RiskMatrixHeatmap';
import { PriorityFindingsList } from '../components/risk/PriorityFindingsList';
import { RecurringVulnerabilities } from '../components/risk/RecurringVulnerabilities';

export function RiskAnalysisPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-2 border-b border-[#e8dbe0]">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
          Risk & Vector Analysis
        </h2>
      </div>

      {/* Primary Analytics: Radar & 5x5 Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <AttackVectorRadar />
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <RiskMatrixHeatmap />
        </div>
      </div>

      {/* Priority Attack Paths */}
      <PriorityFindingsList />

      {/* Recurring Vulnerability Trends */}
      <RecurringVulnerabilities />
    </div>
  );
}
