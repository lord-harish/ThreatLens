import React from 'react';
import { FileTextIcon } from '../common/Icons';

export function EvidenceCitationPanel({ activeCitation }) {
  return (
    <div className="enterprise-card p-4 rounded-xs space-y-3.5 flex flex-col justify-between h-full font-sans">
      <div>
        <div className="flex items-center justify-between pb-2.5 border-b border-[#f0e3e7]">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <FileTextIcon className="w-4 h-4 text-[#0369a1]" />
              Evidence Citation Vault
            </h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              Source excerpts returned by semantic retrieval
            </p>
          </div>
          {activeCitation && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-xs bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] font-bold">
              SOURCE VERIFIED
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          {activeCitation ? (
            <div className="p-3 rounded-xs bg-[#fbf7f8] border border-[#decdd4] space-y-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                Retrieved document source
              </span>
              <div className="text-xs font-bold text-slate-900 break-words">
                {activeCitation.source}
              </div>
              <div className="text-[10px] font-mono text-[#0369a1]">
                {activeCitation.page_number ? `Page ${activeCitation.page_number}` : 'Page not specified'}
                {activeCitation.section_reference ? ` · ${activeCitation.section_reference}` : ''}
              </div>
              <details open>
                <summary className="cursor-pointer text-[10px] font-mono text-slate-600">
                  Exact retrieved excerpt
                </summary>
                <blockquote className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-700 bg-[#fefcfd] p-2 border border-[#decdd4]">
                  {activeCitation.evidence_excerpt}
                </blockquote>
              </details>
              <div className="text-[9px] font-mono text-slate-400 break-all">
                Chunk {activeCitation.chunk_id}
              </div>
            </div>
          ) : (
            <p className="p-3 rounded-xs bg-[#fbf7f8] border border-[#decdd4] text-xs text-slate-500">
              Ask a question to see exact source excerpts retrieved from indexed reports.
            </p>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-[#f0e3e7]">
        <p className="text-[9px] leading-relaxed text-slate-500">
          Citations point to retrieved chunks from the selected indexed reports.
          Unsupported answers are marked as insufficient evidence.
        </p>
      </div>
    </div>
  );
}
