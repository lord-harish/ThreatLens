import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useThreat } from '../context/ThreatContext';
import { FindingsFilterBar } from '../components/findings/FindingsFilterBar';
import { FindingsTable } from '../components/findings/FindingsTable';

export function AuditFindingsPage() {
  const { findings, setActiveFinding, showToast } = useThreat();
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'All');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All');

  useEffect(() => {
    const urlSearch = searchParams.get('search');
    const urlSeverity = searchParams.get('severity');
    const urlStatus = searchParams.get('status');

    if (urlSearch !== null) setSearchQuery(urlSearch);
    if (urlSeverity !== null) setSeverityFilter(urlSeverity);
    if (urlStatus !== null) setStatusFilter(urlStatus);
  }, [searchParams]);

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    updateUrlParams(query, severityFilter, statusFilter);
  };

  const handleSeverityChange = (sev) => {
    setSeverityFilter(sev);
    updateUrlParams(searchQuery, sev, statusFilter);
  };

  const handleStatusChange = (stat) => {
    setStatusFilter(stat);
    updateUrlParams(searchQuery, severityFilter, stat);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSeverityFilter('All');
    setStatusFilter('All');
    setSearchParams({});
  };

  const updateUrlParams = (search, sev, stat) => {
    const params = {};
    if (search) params.search = search;
    if (sev && sev !== 'All') params.severity = sev;
    if (stat && stat !== 'All') params.status = stat;
    setSearchParams(params);
  };

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      const matchesSearch = 
        !searchQuery ||
        f.cve.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.category && f.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesSeverity = severityFilter === 'All' || f.severity === severityFilter;
      const matchesStatus = statusFilter === 'All' || f.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [findings, searchQuery, severityFilter, statusFilter]);

  const handleExportCsv = () => {
    const headers = ['ID', 'CVE', 'Title', 'Severity', 'CVSS', 'Asset', 'Status', 'Report', 'Date'];
    const rows = filteredFindings.map(f => [
      f.id,
      f.cve,
      `"${f.title.replace(/"/g, '""')}"`,
      f.severity,
      f.cvss,
      f.asset,
      f.status,
      `"${f.reportName}"`,
      f.dateDiscovered
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `threatlens_findings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredFindings.length} findings to CSV.`, 'success');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#e8dbe0]">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
          Vulnerability Findings ({filteredFindings.length})
        </h2>
      </div>

      <FindingsFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        severityFilter={severityFilter}
        onSeverityChange={handleSeverityChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        onResetFilters={handleResetFilters}
        totalCount={findings.length}
        filteredCount={filteredFindings.length}
        onExportCsv={handleExportCsv}
      />

      <FindingsTable
        findings={filteredFindings}
        onSelectFinding={(item) => setActiveFinding(item)}
      />
    </div>
  );
}
