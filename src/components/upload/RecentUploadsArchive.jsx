import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from '../common/Icons';
import {
  analyzeDocument,
  deleteDocument,
  extractDocument,
  getExtractedText,
} from '../../api/documents';

export function RecentUploadsArchive({ documents, isLoading, error, onRetry }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [extractingIds, setExtractingIds] = useState(() => new Set());
  const [extractionErrors, setExtractionErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredDocuments = documents.filter((document) =>
    document.original_filename.toLowerCase().includes(search.toLowerCase())
  );

  const handleExtract = async (document) => {
    setExtractingIds((previous) => new Set(previous).add(document.id));
    setExtractionErrors((previous) => ({ ...previous, [document.id]: '' }));
    setPreview(null);
    try {
      const result = await extractDocument(document.id);
      await onRetry();
      if (result.status === 'extracted') {
        const extractedText = await getExtractedText(document.id);
        setPreview(extractedText);
        setCurrentPage(1);
      } else {
        setExtractionErrors((previous) => ({
          ...previous,
          [document.id]: result.error || `Extraction status: ${result.status}.`,
        }));
      }
    } catch (requestError) {
      setExtractionErrors((previous) => ({
        ...previous,
        [document.id]: requestError.message,
      }));
      await onRetry();
    } finally {
      setExtractingIds((previous) => {
        const next = new Set(previous);
        next.delete(document.id);
        return next;
      });
    }
  };

  const showPreview = async (document) => {
    try {
      const extractedText = await getExtractedText(document.id);
      setPreview(extractedText);
      setCurrentPage(1);
      setExtractionErrors((previous) => ({ ...previous, [document.id]: '' }));
    } catch (requestError) {
      setExtractionErrors((previous) => ({
        ...previous,
        [document.id]: requestError.message,
      }));
    }
  };

  const handleAnalyze = async (document) => {
    setExtractingIds((previous) => new Set(previous).add(document.id));
    setExtractionErrors((previous) => ({ ...previous, [document.id]: '' }));
    try {
      await analyzeDocument(document.id);
      await onRetry();
      navigate(`/findings?document_id=${encodeURIComponent(document.id)}`);
    } catch (requestError) {
      setExtractionErrors((previous) => ({
        ...previous,
        [document.id]: requestError.message,
      }));
      await onRetry();
    } finally {
      setExtractingIds((previous) => {
        const next = new Set(previous);
        next.delete(document.id);
        return next;
      });
    }
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete ${document.original_filename}, its extracted text, findings, and indexed vectors?`)) {
      return;
    }
    setExtractingIds((previous) => new Set(previous).add(document.id));
    setExtractionErrors((previous) => ({ ...previous, [document.id]: '' }));
    try {
      await deleteDocument(document.id);
      if (preview?.document_id === document.id) setPreview(null);
      await onRetry();
    } catch (requestError) {
      setExtractionErrors((previous) => ({
        ...previous,
        [document.id]: requestError.message,
      }));
      await onRetry();
    } finally {
      setExtractingIds((previous) => {
        const next = new Set(previous);
        next.delete(document.id);
        return next;
      });
    }
  };

  const isPdfPreview = preview?.extension === '.pdf';
  const previewSegments = preview?.segments.filter((segment) =>
    !isPdfPreview || segment.page_number === currentPage
  ) || [];

  return (
    <div className="enterprise-card p-4 rounded-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#f2e6eb]">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-800 font-semibold">
          Document Repository ({documents.length})
        </div>

        <div className="relative max-w-xs w-full sm:w-auto">
          <SearchIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter documents..."
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
              <th className="py-2 px-3 font-medium">Type</th>
              <th className="py-2 px-3 font-medium hidden sm:table-cell">Size</th>
              <th className="py-2 px-3 font-medium hidden md:table-cell">Uploaded</th>
              <th className="py-2 px-3 font-medium">Status</th>
              <th className="py-2 px-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2e6eb]">
            {filteredDocuments.map((document) => (
              <tr 
                key={document.id}
                className="hover:bg-[#fcf8fa] transition-colors"
              >
                <td className="py-2 px-3">
                  <div className="font-medium text-slate-900">{document.original_filename}</div>
                  {document.analysis_error && (
                    <div className="text-[10px] text-[#9f1239] mt-1 max-w-xs whitespace-normal">
                      {document.analysis_error}
                    </div>
                  )}
                </td>

                <td className="py-2 px-3 font-mono text-[10px] text-slate-600 uppercase">
                  {document.extension.slice(1)}
                </td>

                <td className="py-2 px-3 hidden sm:table-cell text-slate-600 text-[11px]">
                  {formatBytes(document.size_bytes)}
                </td>

                <td className="py-2 px-3 hidden md:table-cell text-slate-600 text-[11px]">
                  {new Date(document.uploaded_at).toLocaleString()}
                </td>

                <td className={`py-2 px-3 font-mono text-[11px] ${
                  document.status === 'failed'
                    || document.status === 'requires_ocr'
                    || document.analysis_status === 'failed'
                    ? 'text-[#9f1239]'
                    : 'text-[#047857]'
                }`}>
                  {extractingIds.has(document.id)
                    ? (document.status === 'extracted' ? 'processing' : 'extracting')
                    : document.analysis_status === 'analyzed'
                      ? 'analyzed'
                      : document.analysis_status === 'failed'
                        ? 'analysis failed'
                        : document.status}
                </td>
                <td className="py-2 px-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-3">
                    {document.status !== 'extracted' && document.status !== 'uploaded' ? (
                      <span className="text-[11px] text-slate-500">Processing…</span>
                    ) : document.status !== 'extracted' ? (
                      <button
                        onClick={() => handleExtract(document)}
                        disabled={extractingIds.has(document.id)}
                        className="text-[11px] text-[#0369a1] hover:underline disabled:opacity-50"
                      >
                        Extract text
                      </button>
                    ) : (
                      <button
                        onClick={() => showPreview(document)}
                        className="text-[11px] text-[#0369a1] hover:underline"
                      >
                        View text
                      </button>
                    )}
                    {document.status === 'extracted' && (
                      extractingIds.has(document.id) || document.analysis_status === 'processing' ? (
                        <span className="text-[11px] text-slate-500">Analyzing…</span>
                      ) : document.analysis_status === 'analyzed' ? (
                        <button
                          onClick={() => navigate(`/findings?document_id=${encodeURIComponent(document.id)}`)}
                          className="text-[11px] text-[#0369a1] hover:underline"
                        >
                          View findings
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAnalyze(document)}
                          className="text-[11px] text-[#0369a1] hover:underline"
                        >
                          Analyze report
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleDelete(document)}
                      disabled={extractingIds.has(document.id)}
                      className="text-[11px] text-[#9f1239] hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !error && filteredDocuments.length === 0 && (
              <tr>
                <td colSpan="6" className="py-5 px-3 text-center text-xs text-slate-500">
                  {documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match this filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isLoading && <div className="text-xs text-slate-500">Loading documents…</div>}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 text-xs text-[#9f1239]">
          <span>{error}</span>
          <button onClick={onRetry} className="underline whitespace-nowrap">Retry</button>
        </div>
      )}
      {Object.entries(extractionErrors).map(([documentId, message]) => message && (
        <div key={documentId} role="alert" className="text-xs text-[#9f1239]">
          {documents.find((document) => document.id === documentId)?.original_filename}: {message}
        </div>
      ))}
      {preview && (
        <section className="border border-[#e8dbe0] rounded-xs p-3 space-y-2" aria-label="Extracted text preview">
          <div className="flex items-center justify-between gap-3 border-b border-[#f2e6eb] pb-2">
            <div className="text-xs font-mono font-semibold text-slate-800">
              Extracted text · {preview.original_filename}
            </div>
            <button
              onClick={() => setPreview(null)}
              className="text-[11px] text-slate-500 hover:text-slate-900"
              aria-label="Close extracted text preview"
            >
              Close
            </button>
          </div>
          {isPdfPreview && (
            <div className="flex items-center justify-between text-xs font-mono">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                className="text-[#0369a1] disabled:text-slate-400"
              >
                Previous page
              </button>
              <span>Page {currentPage} of {preview.page_count}</span>
              <button
                onClick={() => setCurrentPage((page) => Math.min(preview.page_count, page + 1))}
                disabled={currentPage >= preview.page_count}
                className="text-[#0369a1] disabled:text-slate-400"
              >
                Next page
              </button>
            </div>
          )}
          <div className="max-h-96 overflow-auto bg-[#fbf7f8] border border-[#f2e6eb] rounded-xs p-3 space-y-3">
            {previewSegments.length === 0 ? (
              <p className="text-xs text-slate-500">No text was extracted from this page.</p>
            ) : previewSegments.map((segment) => (
              <article key={segment.sequence_index} className="space-y-1">
                <div className="text-[10px] font-mono text-slate-500">
                  {segment.source_reference}
                  {segment.section_reference ? ` · ${segment.section_reference}` : ''}
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs font-sans text-slate-800">
                  {segment.extracted_text}
                </pre>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
