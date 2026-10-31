import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer } from '../common/Drawer';
import { SeverityBadge, StatusBadge, ComplianceTag } from '../common/Badge';
import { Button } from '../common/Button';
import { CopyIcon, CheckIcon, TerminalIcon, FileTextIcon, AlertIcon } from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function FindingDetailDrawer() {
  const { activeFinding, setActiveFinding, updateFindingStatus, showToast } = useThreat();
  const navigate = useNavigate();
  const [copiedCode, setCopiedCode] = useState(false);

  if (!activeFinding) return null;

  const handleCopy = () => {
    if (activeFinding.remediation) {
      navigator.clipboard.writeText(activeFinding.remediation);
      setCopiedCode(true);
      showToast('Remediation commands copied to clipboard.', 'info');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleAskAi = () => {
    const findingRef = activeFinding;
    setActiveFinding(null);
    navigate(`/ai-assistant?prompt=${encodeURIComponent(`Provide a deep blast radius evaluation and validation commands for ${findingRef.cve} on asset ${findingRef.asset}.`)}`);
  };

  return (
    <Drawer
      isOpen={Boolean(activeFinding)}
      onClose={() => setActiveFinding(null)}
      title={
        <div className="flex items-center gap-2 flex-wrap font-mono">
          <span className="text-xs px-1.5 py-0.5 rounded-xs bg-[#f2e8ec] text-slate-800 font-bold border border-[#decdd4]">
            {activeFinding.id}
          </span>
          <span className="text-sm font-bold text-slate-900">
            {activeFinding.cve}
          </span>
          <SeverityBadge severity={activeFinding.severity} size="xs" />
        </div>
      }
      subtitle={activeFinding.title}
      footer={
        <div className="flex items-center justify-between gap-3 w-full font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Status:</span>
            <select
              value={activeFinding.status}
              onChange={(e) => updateFindingStatus(activeFinding.id, e.target.value)}
              className="text-xs font-mono rounded-xs bg-[#ffffff] border border-[#decdd4] px-2 py-1 text-slate-900 focus:outline-none focus:border-[#0369a1]"
            >
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Risk Accepted">Risk Accepted</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={TerminalIcon}
              onClick={handleAskAi}
            >
              Analyze with AI
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                updateFindingStatus(
                  activeFinding.id,
                  activeFinding.status === 'Resolved' ? 'Open' : 'Resolved'
                );
              }}
            >
              {activeFinding.status === 'Resolved' ? 'Reopen Finding' : 'Mark Resolved'}
            </Button>
          </div>
        </div>
      }
    >
      {/* 4 Metadata Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-center">
        <div className="p-2.5 rounded-xs enterprise-card">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">CVSS v3.1</div>
          <div className="text-base font-bold text-[#9f1239] mt-0.5">
            {activeFinding.cvss} / 10
          </div>
        </div>

        <div className="p-2.5 rounded-xs enterprise-card">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Asset Tier</div>
          <div className="text-xs font-bold text-slate-800 mt-0.5 truncate">
            {activeFinding.assetCriticality || 'Tier-1 Mission Critical'}
          </div>
        </div>

        <div className="p-2.5 rounded-xs enterprise-card">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">SLA Window</div>
          <div className="text-xs font-bold text-[#b45309] mt-0.5 truncate">
            {activeFinding.remediationTimeline || 'Immediate (24h)'}
          </div>
        </div>

        <div className="p-2.5 rounded-xs enterprise-card">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Status</div>
          <div className="mt-1">
            <StatusBadge status={activeFinding.status} size="xs" />
          </div>
        </div>
      </div>

      {/* Asset & Audit Context */}
      <div className="enterprise-card p-3.5 rounded-xs space-y-2.5">
        <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
          Target Scope & Attribution
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400 font-mono text-[10px] block">Affected Asset</span>
            <span className="font-mono font-bold text-slate-900 bg-[#fbf7f8] px-1.5 py-0.5 rounded-xs border border-[#decdd4] inline-block mt-0.5">
              {activeFinding.asset}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-mono text-[10px] block">Asset Classification</span>
            <span className="text-slate-800 font-medium mt-0.5 block">
              {activeFinding.assetType || 'Infrastructure Enclave'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-mono text-[10px] block">Source Document</span>
            <span className="text-[#0369a1] font-mono text-[11px] mt-0.5 block truncate">
              {activeFinding.reportName}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-mono text-[10px] block">Responsible Assignee</span>
            <span className="text-slate-800 font-medium mt-0.5 block">
              {activeFinding.assignee || 'SecOps Team Pool'}
            </span>
          </div>
        </div>

        {activeFinding.cvssVector && (
          <div className="pt-2 border-t border-[#f0e3e7]">
            <span className="text-[9px] font-mono text-slate-400 block mb-0.5">CVSS Vector String</span>
            <code className="text-[10px] font-mono text-slate-800 bg-[#fbf7f8] px-2 py-1 rounded-xs border border-[#decdd4] block overflow-x-auto">
              {activeFinding.cvssVector}
            </code>
          </div>
        )}
      </div>

      {/* Technical Threat Impact */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
          Exploit Impact Analysis
        </div>
        <div className="p-3 rounded-xs bg-[#fff1f2] border border-[#fecdd3] text-xs text-[#9f1239] leading-relaxed">
          {activeFinding.impact}
        </div>
      </div>

      {/* Raw Technical Evidence (NO fake terminal traffic light dots) */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
          Technical PoC / Verification Log
        </div>
        <div className="p-3 rounded-xs bg-[#0f172a] text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed">
          <pre className="whitespace-pre-wrap">{activeFinding.evidence}</pre>
        </div>
      </div>

      {/* Prescribed Remediation */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
            Prescribed Mitigation Procedure
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-mono text-[#0369a1] hover:underline"
          >
            {copiedCode ? <CheckIcon className="w-3 h-3 text-[#047857]" /> : <CopyIcon className="w-3 h-3" />}
            <span>{copiedCode ? 'Copied' : 'Copy Commands'}</span>
          </button>
        </div>

        <div className="p-3 rounded-xs bg-[#fbf7f8] border border-[#decdd4] text-[11px] font-mono text-slate-900 whitespace-pre-wrap leading-relaxed">
          {activeFinding.remediation}
        </div>
      </div>

      {/* Compliance Framework Controls */}
      {activeFinding.compliance && activeFinding.compliance.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-500">
            Applicable Regulatory Controls
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeFinding.compliance.map((item, idx) => (
              <ComplianceTag key={idx}>
                {item}
              </ComplianceTag>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
