import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLinkIcon } from '../common/Icons';
import { fetchDocuments } from '../../api/documents';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function documentStatus(document) {
  if (document.analysis_status === 'analyzed') return 'Analyzed';
  if (document.analysis_status === 'failed') return 'Analysis failed';
  if (document.status === 'extracted') return 'Extracted';
  if (document.status === 'failed' || document.status === 'requires_ocr') return document.status.replace('_', ' ');
  return 'Uploaded';
}

export function RecentReportsTable() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then((documents) => {
        if (active) setReports(documents);
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
    <div className="enterprise-card p-4 rounded-xs">
      <div className="flex items-center justify-between pb-3 border-b border-[#f2e6eb]">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Recent Reports
        </h3>
        <button
          onClick={() => navigate('/upload')}
          className="text-xs font-mono text-[#0369a1] hover:underline"
        >
          View all{reports.length ? ` (${reports.length})` : ''}
        </button>
      </div>

      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-[#e8dbe0] text-slate-500 font-mono text-[10px] uppercase">
              <th className="py-2 px-3 font-medium">Document</th>
              <th className="py-2 px-3 font-medium hidden md:table-cell">Uploaded</th>
              <th className="py-2 px-3 font-medium">Findings</th>
              <th className="py-2 px-3 font-medium">Processing</th>
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
                  <div className="font-medium text-slate-900">{report.original_filename}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {report.extension?.toUpperCase().replace('.', '') || 'FILE'} · {formatBytes(report.size_bytes)}
                  </div>
                </td>

                <td className="py-2.5 px-3 hidden md:table-cell text-slate-600 text-[11px]">
                  {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString() : 'Date unavailable'}
                </td>

                <td className="py-2.5 px-3 font-mono text-xs text-slate-800">
                  {report.finding_count ?? 0}
                </td>

                <td className="py-2.5 px-3 font-mono text-[11px] text-[#047857]">
                  {documentStatus(report)}
                </td>

                <td className="py-2.5 px-3 text-right">
                  <button
                    onClick={() => navigate(`/findings?document_id=${encodeURIComponent(report.id)}`)}
                    className="p-1 text-slate-400 hover:text-slate-900 rounded-xs"
                    aria-label="Inspect Findings"
                  >
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !error && reports.length === 0 && (
              <tr><td colSpan="5" className="py-7 text-center text-xs text-slate-500">
                No uploaded documents yet. Upload a PDF, DOCX, or TXT report to get started.
              </td></tr>
            )}
            {loading && <tr><td colSpan="5" className="py-7 text-center text-xs text-slate-500">Loading uploaded documents…</td></tr>}
            {error && <tr><td colSpan="5" role="alert" className="py-7 text-center text-xs text-[#9f1239]">{error}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
