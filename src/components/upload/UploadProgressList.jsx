import React from 'react';
import { CloseIcon, CheckIcon } from '../common/Icons';

export function UploadProgressList({ activeUploads, onCancelUpload }) {
  if (!activeUploads || activeUploads.length === 0) return null;

  return (
    <div className="enterprise-card p-3 rounded-xs space-y-2">
      <div className="text-[11px] font-mono uppercase text-slate-500 font-semibold pb-1 border-b border-[#f2e6eb]">
        Ingestion Queue ({activeUploads.length})
      </div>

      <div className="space-y-2">
        {activeUploads.map((item) => {
          const isDone = item.progress >= 100;
          return (
            <div
              key={item.id}
              className="p-2.5 rounded-xs bg-[#fbf7f8] border border-[#e8dbe0] space-y-1.5 font-mono text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.fileName}</span>
                  <span className="text-slate-400 text-[10px]">({item.fileSizeFormatted})</span>
                </div>

                {isDone ? (
                  <span className="text-[10px] text-[#047857] font-semibold flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" />
                    Verified
                  </span>
                ) : (
                  <button
                    onClick={() => onCancelUpload(item.id)}
                    className="text-slate-400 hover:text-slate-800 p-0.5"
                    aria-label="Cancel"
                  >
                    <CloseIcon className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{item.currentStageText}</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="w-full bg-[#e8dbe0] h-1 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-[#0369a1] transition-all duration-150"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
