import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileTextIcon, ExternalLinkIcon, ShieldIcon } from '../common/Icons';

export function EvidenceCitationPanel({ activeCitation }) {
  const navigate = useNavigate();

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
              Grounded in 6 ingested enterprise audit archives
            </p>
          </div>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-xs bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] font-bold">
            NIST GROUNDED
          </span>
        </div>

        {/* Selected Citation Record */}
        <div className="mt-3 space-y-2.5">
          <div className="p-3 rounded-xs bg-[#fbf7f8] border border-[#decdd4] space-y-1.5">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Active Verified Source:
            </span>
            <div className="text-xs font-bold text-slate-900 font-sans">
              {activeCitation?.source || 'PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf'}
            </div>
            <div className="text-[10px] font-mono text-[#0369a1]">
              {activeCitation?.section || 'Section 4.1: Critical Bastion Findings, Page 18'}
            </div>
            <p className="text-[11px] text-slate-700 bg-[#fefcfd] p-2 rounded-xs border border-[#decdd4] leading-relaxed">
              "{activeCitation?.relevance || 'Identifies vulnerable liblzma.so.5.6.1 in memory of 10.240.12.8 (bastion-us-east-prod-01) with unauthenticated root execution pathway.'}"
            </p>

            {activeCitation?.cve && (
              <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
                <span className="text-slate-500">Related Record:</span>
                <button
                  onClick={() => navigate(`/findings?search=${encodeURIComponent(activeCitation.cve)}`)}
                  className="text-[#0369a1] font-bold hover:underline flex items-center gap-1"
                >
                  <span>{activeCitation.cve}</span>
                  <ExternalLinkIcon className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Applicable Standards List */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
              Correlated Regulatory Benchmarks:
            </span>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="p-1.5 rounded-xs bg-[#fbf7f8] border border-[#decdd4] flex justify-between text-slate-700">
                <span className="font-bold">NIST SP 800-53 (SI-2)</span>
                <span className="text-[10px] text-slate-500">Flaw Remediation</span>
              </div>
              <div className="p-1.5 rounded-xs bg-[#fbf7f8] border border-[#decdd4] flex justify-between text-slate-700">
                <span className="font-bold">ISO/IEC 27001 (A.12.6)</span>
                <span className="text-[10px] text-slate-500">Technical Vulnerabilities</span>
              </div>
              <div className="p-1.5 rounded-xs bg-[#fbf7f8] border border-[#decdd4] flex justify-between text-slate-700">
                <span className="font-bold">SOC2 Type II (CC7.1)</span>
                <span className="text-[10px] text-slate-500">Vulnerability Monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#f0e3e7]">
        <button
          onClick={() => navigate('/upload')}
          className="w-full py-1.5 px-3 rounded-xs border border-[#decdd4] bg-[#fbf7f8] hover:bg-[#f2e8ec] text-xs font-mono font-bold text-slate-800 text-center transition-colors"
        >
          Inspect Ingested Document Vault
        </button>
      </div>
    </div>
  );
}
