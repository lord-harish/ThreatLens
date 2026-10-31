import React from 'react';
import { CloseIcon, ShieldIcon } from './Icons';

export function LegalModal({ isOpen, type, onClose }) {
  if (!isOpen) return null;

  const isTOS = type === 'tos';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
      <div className="bg-[#fefcfd] border border-[#decdd4] w-full max-w-2xl max-h-[85vh] flex flex-col rounded-sm">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#decdd4] flex items-center justify-between bg-[#fbf7f8]">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4 text-[#0369a1]" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-mono">
              {isTOS ? 'Enterprise Terms of Service (Rev. 2026.4)' : 'Security & Data Processing Agreement (SOC2 / ISO 27001)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 p-1"
            aria-label="Close"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto text-xs text-slate-700 space-y-4 leading-relaxed font-sans">
          {isTOS ? (
            <>
              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  1. Scope of Audit Intelligence Services
                </h4>
                <p>
                  ThreatLens provides enterprise-tier cybersecurity decision support, vulnerability synthesis, and attack vector calculation. All findings extracted from uploaded third-party reports remain the proprietary, confidential intellectual property of the subscribing organization.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  2. Vulnerability Confidentiality and Non-Disclosure
                </h4>
                <p>
                  In accordance with responsible disclosure guidelines and international cybersecurity standards, zero-day vulnerabilities, proof-of-concept exploits, and infrastructure topologies indexed within the system are encrypted in transit via TLS 1.3 and at rest via FIPS 140-3 validated AES-256 modules.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  3. Remediation SLAs and Decision Support Disclaimer
                </h4>
                <p>
                  While ThreatLens synthesizes guidance from NIST Special Publication 800-53 Rev. 5 and CIS Benchmarks, final operational deployment of patches, firewall rules, and container image deprecations rests with authorized enterprise security personnel.
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  1. Data Processing and Zero-Retention Guarantee
                </h4>
                <p>
                  ThreatLens operates under a strict Zero-Retention model regarding third-party large language models. Customer audit reports, CVE listings, and server IP registries are never utilized to train, fine-tune, or calibrate shared foundation weights.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  2. Sovereign Boundary Isolation (SOC2 Type II & ISO 27001)
                </h4>
                <p>
                  Each enterprise workspace resides in an isolated logical tenant boundary. Document buffers processed during ingestion are scrubbed from ephemeral memory within 120 seconds of vector mapping completion.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] mb-1">
                  3. Audit Trail and Forensic Logging
                </h4>
                <p>
                  All user access, finding status transitions, report deletions, and query requests generate immutable cryptographic logs compliant with NIST SP 800-92 standards for forensic review.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#decdd4] bg-[#fbf7f8] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono font-medium bg-[#0f172a] text-white rounded-xs hover:bg-slate-800"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
