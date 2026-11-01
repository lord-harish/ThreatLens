import React, { useState, useRef } from 'react';
import { UploadIcon, AlertIcon } from '../common/Icons';
import { Button } from '../common/Button';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const VALID_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

export function Dropzone({ onFilesSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileErrors, setFileErrors] = useState([]);
  const fileInputRef = useRef(null);

  const validateAndProcessFiles = (fileList) => {
    const acceptedFiles = [];
    const errors = [];

    Array.from(fileList).forEach((file) => {
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (!VALID_EXTENSIONS.has(extension)) {
        errors.push(`${file.name}: unsupported file type. Choose PDF, DOCX, or TXT.`);
      } else if (file.size === 0) {
        errors.push(`${file.name}: empty files cannot be uploaded.`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds the 20 MB per-file limit.`);
      } else {
        acceptedFiles.push(file);
      }
    });

    setFileErrors(errors);
    if (acceptedFiles.length > 0) onFilesSelected(acceptedFiles);
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
    validateAndProcessFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2.5">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
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
          multiple
          className="hidden"
          onClick={(event) => event.stopPropagation()}
          onChange={(e) => {
            validateAndProcessFiles(e.target.files || []);
            e.target.value = '';
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-2.5 max-w-sm mx-auto">
          <UploadIcon className="w-5 h-5 text-slate-500" />

          <div>
            <div className="text-xs font-semibold text-slate-900 font-sans">
              Drop audit report document here or browse
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              PDF, DOCX, or TXT · up to 20 MB per file · multiple files supported
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Select Document
          </Button>

          {fileErrors.length > 0 && (
            <ul
              role="alert"
              className="text-xs text-[#9f1239] bg-[#fff1f2] px-2.5 py-1 rounded-xs border border-[#fecdd3] font-mono mt-1 space-y-1 text-left"
            >
              {fileErrors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
