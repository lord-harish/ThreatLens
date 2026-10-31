import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLinkIcon } from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function RecentReportsTable() {
  const { reports } = useThreat();
  const navigate = useNavigate();

  return (
    <div className="enterprise-card p-4 rounded-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Recent Reports
        </h3>
        <button
          onClick={() => navigate('/upload')}
          className="text-xs font-mono text-[#0369a1] hover:underline"
        >
          View all ({reports.length})
        </button>
      </div>

      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-[#e8dbe0] text-slate-500 font-mono text-[10px] uppercase">
              <th className="py-2 px-3 font-medium">Document</th>
              <th className="py-2 px-3 font-medium hidden md:table-cell">Auditor</th>
              <th className="py-2 px-3 font-medium hidden sm:table-cell">Framework</th>
              <th className="py-2 px-3 font-medium">Findings</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2e6eb]">
            {reports.slice(0, 4).map((report) => (
              <tr 
                key={report.id}
                className="hover:bg-[#fcf8fa] transition-colors"
              >
                <td className="py-2.5 px-3">
                  <div className="font-medium text-slate-900">{report.title}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {report.fileName} · {report.size}
                  </div>
                </td>

                <td className="py-2.5 px-3 hidden md:table-cell text-slate-600 text-[11px]">
                  {report.organization}
                </td>

                <td className="py-2.5 px-3 hidden sm:table-cell font-mono text-[10px] text-slate-600">
                  {report.framework}
                </td>

                <td className="py-2.5 px-3 font-mono text-xs text-slate-800">
                  {report.findingsCount}
                  {report.criticalCount > 0 && (
                    <span className="text-[#9f1239] font-semibold ml-1.5">
                      ({report.criticalCount} crit)
                    </span>
                  )}
                </td>

                <td className="py-2.5 px-3 font-mono text-[11px] text-[#047857]">
                  {report.status}
                </td>

                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => navigate('/findings')}
                    className="p-1 text-slate-400 hover:text-slate-900 rounded-xs"
                    aria-label="Inspect Findings"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
