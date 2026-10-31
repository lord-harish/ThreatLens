import React from 'react';
import { SeverityBadge, StatusBadge } from '../common/Badge';
import { ChevronRightIcon, ServerIcon, FileTextIcon, AlertIcon } from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function FindingsTable({ findings, onSelectFinding }) {
  const { updateFindingStatus } = useThreat();

  if (findings.length === 0) {
    return (
      <div className="enterprise-card p-10 text-center font-mono text-xs text-slate-500">
        No findings match current filter criteria.
      </div>
    );
  }

  return (
    <div className="enterprise-card rounded-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-[#e8dbe0] bg-[#faf5f7] text-slate-500 font-mono text-[10px] uppercase">
              <th className="py-2.5 px-3 font-medium">Vulnerability / CVE</th>
              <th className="py-2.5 px-3 font-medium text-center">Severity</th>
              <th className="py-2.5 px-3 font-medium text-center">CVSS</th>
              <th className="py-2.5 px-3 font-medium">Affected Asset</th>
              <th className="py-2.5 px-3 font-medium hidden md:table-cell">Report</th>
              <th className="py-2.5 px-3 font-medium">Status</th>
              <th className="py-2.5 px-3 font-medium text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2e6eb]">
            {findings.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelectFinding(item)}
                className="hover:bg-[#fcf8fa] cursor-pointer transition-colors"
              >
                {/* Vulnerability Name & CVE */}
                <td className="py-2.5 px-3 max-w-xs sm:max-w-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-semibold text-slate-900 bg-[#f2e6eb] px-1 py-0.2 rounded-xs">
                      {item.cve}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.id}
                    </span>
                  </div>
                  <div className="font-medium text-slate-900 mt-0.5 text-xs line-clamp-1">
                    {item.title}
                  </div>
                </td>

                {/* Severity */}
                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                  <SeverityBadge severity={item.severity} size="xs" />
                </td>

                {/* CVSS Score */}
                <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
                  {item.cvss}
                </td>

                {/* Affected Asset */}
                <td className="py-2.5 px-3 whitespace-nowrap max-w-[170px] font-mono text-xs text-slate-700">
                  <div className="truncate" title={item.asset}>
                    {item.asset}
                  </div>
                </td>

                {/* Audit Report */}
                <td className="py-2.5 px-3 hidden md:table-cell max-w-[180px] text-xs text-slate-600">
                  <div className="truncate" title={item.reportName}>
                    {item.reportName}
                  </div>
                </td>

                {/* Remediation Status with fast click toggle */}
                <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={item.status}
                    onChange={(e) => updateFindingStatus(item.id, e.target.value)}
                    className="text-[11px] font-mono rounded-xs bg-white border border-[#e8dbe0] px-2 py-0.5 text-slate-800 focus:outline-none"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Risk Accepted">Risk Accepted</option>
                  </select>
                </td>

                {/* View Details Icon */}
                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectFinding(item);
                    }}
                    className="p-1 rounded-xs text-slate-400 hover:text-slate-900"
                    aria-label="View Details"
                  >
                    <ChevronRightIcon className="w-3.5 h-3.5" />
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
