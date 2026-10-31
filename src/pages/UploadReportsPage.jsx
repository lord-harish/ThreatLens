import React, { useState } from 'react';
import { useThreat } from '../context/ThreatContext';
import { Dropzone } from '../components/upload/Dropzone';
import { UploadProgressList } from '../components/upload/UploadProgressList';
import { RecentUploadsArchive } from '../components/upload/RecentUploadsArchive';

export function UploadReportsPage() {
  const { addReportWithFindings, showToast } = useThreat();
  const [activeUploads, setActiveUploads] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '1.2 MB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileSelected = (file, sampleMeta = null) => {
    setIsUploading(true);
    const ext = file.name.split('.').pop().toUpperCase();
    const uploadId = `UPL-${Date.now()}`;
    const formattedSize = formatBytes(file.size);

    const newUploadItem = {
      id: uploadId,
      fileName: file.name,
      format: ext,
      fileSizeFormatted: formattedSize,
      progress: 20,
      currentStageText: 'Reading document stream...',
      statusMessage: 'Buffering'
    };

    setActiveUploads(prev => [newUploadItem, ...prev]);

    const stages = [
      { pct: 50, stage: 'Parsing structure and CVE patterns...', msg: 'Parsing' },
      { pct: 85, stage: 'Correlating asset mappings...', msg: 'Mapping' },
      { pct: 100, stage: 'Ingestion verified. Synced to registry.', msg: 'Complete' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < stages.length) {
        const stepData = stages[currentStep];
        setActiveUploads(prev =>
          prev.map(item =>
            item.id === uploadId
              ? {
                  ...item,
                  progress: stepData.pct,
                  currentStageText: stepData.stage,
                  statusMessage: stepData.msg
                }
              : item
          )
        );
        currentStep++;
      } else {
        clearInterval(interval);
        setIsUploading(false);

        const reportTitle = sampleMeta?.name 
          ? sampleMeta.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")
          : file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

        const newReport = {
          id: `REP-2026-${Math.floor(100 + Math.random() * 900)}`,
          title: reportTitle,
          fileName: file.name,
          format: ext,
          size: formattedSize,
          uploadedAt: new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit'
          }),
          auditor: sampleMeta?.auditor || 'Internal SecOps',
          organization: sampleMeta?.auditor || 'SecOps Engineering',
          framework: sampleMeta?.framework || 'NIST SP 800-53',
          status: 'Parsed',
          findingsCount: 14,
          criticalCount: 2,
          highCount: 5,
          mediumCount: 4,
          lowCount: 3,
          confidenceScore: 99.2,
          summary: `Audit extraction from ${file.name}. 14 findings parsed with CVSS scores and remediation steps.`
        };

        const sampleGeneratedFindings = [
          {
            id: `TL-FIND-${Math.floor(1100 + Math.random() * 900)}`,
            cve: `CVE-2024-${Math.floor(1000 + Math.random() * 8999)}`,
            title: `Hardcoded API Secret in ${file.name}`,
            severity: "Critical",
            cvss: 9.4,
            cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:L/A:N",
            asset: "vault-transit-service.threatlens.internal",
            assetType: "Microservice Ingress",
            assetCriticality: "Tier-1 Mission Critical",
            reportName: reportTitle,
            reportDate: new Date().toISOString().split('T')[0],
            status: "Open",
            category: "Credential Exposure",
            remediationTimeline: "Immediate (4 Hours)",
            assignee: "Marcus Vance",
            impact: "High entropy secret discovered in test scripts allows decrypt of customer secrets.",
            evidence: `Regex match in document section 4.2 identified token: sk_live_99831a89bf...`,
            remediation: "Revoke API token key in Vault transit engine and purge from source control.",
            compliance: ["NIST SP 800-53 (IA-5)", "PCI-DSS Req 8.2"],
            dateDiscovered: new Date().toISOString().split('T')[0]
          }
        ];

        addReportWithFindings(newReport, sampleGeneratedFindings);
      }
    }, 450);
  };

  const handleCancelUpload = (uploadId) => {
    setActiveUploads(prev => prev.filter(item => item.id !== uploadId));
    setIsUploading(false);
    showToast('Upload cancelled.', 'info');
  };

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-[#e8dbe0]">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
          Report Ingestion
        </h2>
      </div>

      <Dropzone 
        onFileSelected={handleFileSelected}
        isUploading={isUploading}
      />

      <UploadProgressList
        activeUploads={activeUploads}
        onCancelUpload={handleCancelUpload}
      />

      <RecentUploadsArchive />
    </div>
  );
}
