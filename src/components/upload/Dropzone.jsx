import React, { useState, useRef } from 'react';
import { UploadIcon, AlertIcon } from '../common/Icons';
import { Button } from '../common/Button';

export function Dropzone({ onFileSelected, isUploading }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragError, setDragError] = useState(null);
  const fileInputRef = useRef(null);

  const validateAndProcessFile = (file) => {
    setDragError(null);
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      setDragError(`Unsupported format: ${file.name}. Please upload PDF, DOCX, or TXT.`);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setDragError('File exceeds 50MB maximum allowable threshold.');
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSample = (name, type, size, auditor, framework) => {
    const fakeFile = new File(["Raw audit payload."], name, { type });
    Object.defineProperty(fakeFile, 'size', { value: size });
    onFileSelected(fakeFile, { name, auditor, framework });
  };

  return (
    <div className="space-y-2.5">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          p-6 sm:p-8 text-center cursor-pointer transition-colors enterprise-card rounded-xs
          border border-dashed
          ${isDragOver 
            ? 'border-[#0369a1] bg-[#f0f9ff]' 
            : 'border-[#decdd4] bg-white hover:bg-[#faf5f7]'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              validateAndProcessFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2.5 max-w-sm mx-auto">
          <UploadIcon className="w-5 h-5 text-slate-500" />

          <div>
            <div className="text-xs font-semibold text-slate-900 font-sans">
              Drop audit report document here or browse
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              PDF, DOCX, or TXT up to 50MB
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            loading={isUploading}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select Document
          </Button>

          {dragError && (
            <div className="text-xs text-[#9f1239] bg-[#ffe4e6] px-2.5 py-1 rounded-xs border border-[#fecdd3] font-mono mt-1">
              {dragError}
            </div>
          )}
        </div>
      </div>

      {/* Minimal Test Loaders */}
      <div className="p-2.5 rounded-xs enterprise-card flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="text-slate-500 text-[11px]">Load test audit fixtures:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleSample('Q4_Cloud_PenTest.pdf', 'application/pdf', 7420100, 'NCC Group', 'SOC2 / ISO 27001')}
            className="px-2 py-0.5 rounded-xs border border-[#e8dbe0] bg-white text-slate-700 hover:bg-[#f2e6eb] text-[10px]"
          >
            Sample PDF (7.4 MB)
          </button>
          <button
            onClick={() => handleSample('API_OAuth_Audit.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 3200450, 'Bishop Fox', 'OWASP API')}
            className="px-2 py-0.5 rounded-xs border border-[#e8dbe0] bg-white text-slate-700 hover:bg-[#f2e6eb] text-[10px]"
          >
            Sample DOCX (3.2 MB)
          </button>
          <button
            onClick={() => handleSample('Nmap_OpenPorts.txt', 'text/plain', 980400, 'ThreatLens Daemon', 'NIST CSF')}
            className="px-2 py-0.5 rounded-xs border border-[#e8dbe0] bg-white text-slate-700 hover:bg-[#f2e6eb] text-[10px]"
          >
            Sample TXT (980 KB)
          </button>
        </div>
      </div>
    </div>
  );
}
