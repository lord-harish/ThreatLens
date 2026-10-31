import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, DownloadIcon, ExternalLinkIcon, TrashIcon } from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function RecentUploadsArchive() {
  const { reports, deleteReport, showToast } = useThreat();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredReports = reports.filter((r) => {
    return (
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.fileName.toLowerCase().includes(search.toLowerCase()) ||
      r.organization.toLowerCase().includes(search.toLowerCase()) ||
      r.framework.toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleDownload = (rep) => {
    showToast(`Downloading: ${rep.fileName}`, 'info');
  };

  return (
    <div className="enterprise-card p-4 rounded-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#f2e6eb]">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Report Repository ({reports.length})
        </div>

        <div className="relative max-w-xs w-full sm:w-auto">
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-2.5 py-1 text-xs enterprise-input rounded-xs w-full sm:w-56 font-mono"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-[#e8dbe0] text-slate-500 font-mono text-[10px] uppercase">
              <th className="py-2 px-3 font-medium">Document</th>
              <th className="py-2 px-3 font-medium hidden md:table-cell">Auditor</th>
              <th className="py-2 px-3 font-medium hidden sm:table-cell">Framework</th>
              <th className="py-2 px-3 font-medium">Findings</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2e6eb]">
            {filteredReports.map((report) => (
              <tr 
                key={report.id}
                className="hover:bg-[#fcf8fa] transition-colors"
              >
                <td className="py-2 px-3">
                  <div className="font-medium text-slate-900">{report.title}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {report.fileName} · {report.size} · {report.uploadedAt}
                  </div>
                </td>

                <td className="py-2 px-3 hidden md:table-cell text-slate-600 text-[11px]">
                  {report.organization}
                </td>

                <td className="py-2 px-3 hidden sm:table-cell font-mono text-[10px] text-slate-600">
                  {report.framework}
                </td>

                <td className="py-2 px-3 font-mono text-xs text-slate-800">
                  {report.findingsCount}
                  {report.criticalCount > 0 && (
                    <span className="text-[#9f1239] font-semibold ml-1">
                      ({report.criticalCount} crit)
                    </span>
                  )}
                </td>

                <td className="py-2 px-3 font-mono text-[11px] text-[#047857]">
                  {report.status}
                </td>

                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => handleDownload(report)}
                      className="p-1 text-slate-400 hover:text-slate-800 rounded-xs"
                      title="Download"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => navigate('/findings')}
                      className="p-1 text-slate-400 hover:text-slate-800 rounded-xs"
                      title="Inspect Findings"
                    >
                      <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-1 text-slate-400 hover:text-[#9f1239] rounded-xs"
                      title="Delete"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
