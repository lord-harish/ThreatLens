import React from 'react';
import { SearchIcon, DownloadIcon, CloseIcon } from '../common/Icons';
import { Button } from '../common/Button';

export function FindingsFilterBar({
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityChange,
  statusFilter,
  onStatusChange,
  onResetFilters,
  totalCount,
  filteredCount,
  onExportCsv
}) {
  const severities = ['All', 'Critical', 'High', 'Medium', 'Low', 'Info'];
  const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Risk Accepted'];

  const hasActiveFilters = searchQuery !== '' || severityFilter !== 'All' || statusFilter !== 'All';

  return (
    <div className="enterprise-card p-3 rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      {/* Search Field */}
      <div className="relative flex-1 max-w-sm">
        <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Filter CVE, title, or asset..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-7 py-1 text-xs font-mono enterprise-input rounded-xs"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <CloseIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dropdown Filters & Actions */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <select
            value={severityFilter}
            onChange={(e) => onSeverityChange(e.target.value)}
            className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-slate-800 text-xs focus:outline-none"
          >
            {severities.map((s) => (
              <option key={s} value={s}>{s === 'All' ? 'All Severities' : s}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-slate-800 text-xs focus:outline-none"
          >
            {statuses.map((st) => (
              <option key={st} value={st}>{st === 'All' ? 'All Statuses' : st}</option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="text-[11px] text-[#9f1239] hover:underline px-1"
          >
            Reset
          </button>
        )}

        <Button
          variant="secondary"
          size="sm"
          icon={DownloadIcon}
          onClick={onExportCsv}
        >
          CSV
        </Button>
      </div>
    </div>
  );
}
