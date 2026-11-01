import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDocuments, uploadDocument } from '../api/documents';
import { Dropzone } from '../components/upload/Dropzone';
import { RecentUploadsArchive } from '../components/upload/RecentUploadsArchive';
import { UploadProgressList } from '../components/upload/UploadProgressList';

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

export function UploadReportsPage() {
  const [activeUploads, setActiveUploads] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState('');
  const uploadRequests = useRef(new Map());

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError('');
    try {
      setDocuments(await fetchDocuments());
    } catch (error) {
      setDocumentsError(error.message);
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => () => {
    uploadRequests.current.forEach((request) => request.abort());
    uploadRequests.current.clear();
  }, []);

  const handleFilesSelected = (files) => {
    const newUploads = files.map((file) => {
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const extension = file.name.split('.').pop().toLowerCase();
      return {
        id,
        fileName: file.name,
        extension,
        fileSizeFormatted: formatBytes(file.size),
        progress: 0,
        currentStageText: 'Sending file to document service...',
        statusMessage: 'Uploading',
        status: 'uploading',
      };
    });

    setActiveUploads((previous) => [...newUploads, ...previous]);

    files.forEach((file, index) => {
      const upload = newUploads[index];
      const request = uploadDocument(file, (progress) => {
        if (!uploadRequests.current.has(upload.id)) return;
        setActiveUploads((previous) => previous.map((item) =>
          item.id === upload.id ? { ...item, progress: Math.min(progress, 99) } : item
        ));
      });
      uploadRequests.current.set(upload.id, request);

      request.promise.then((document) => {
        if (!uploadRequests.current.delete(upload.id)) return;
        setActiveUploads((previous) => previous.map((item) =>
          item.id === upload.id
            ? {
                ...item,
                progress: 100,
                currentStageText: 'File stored. No document processing has been run.',
                statusMessage: document.status,
                status: 'uploaded',
              }
            : item
        ));
        setDocuments((previous) => [
          document,
          ...previous.filter((existing) => existing.id !== document.id),
        ]);
      }).catch((error) => {
        if (!uploadRequests.current.delete(upload.id)) return;
        setActiveUploads((previous) => previous.map((item) =>
          item.id === upload.id
            ? {
                ...item,
                currentStageText: 'Upload failed',
                statusMessage: 'Failed',
                status: 'error',
                errorMessage: error.message,
              }
            : item
        ));
      });
    });
  };

  const handleRemoveUpload = (uploadId) => {
    const request = uploadRequests.current.get(uploadId);
    if (request) {
      uploadRequests.current.delete(uploadId);
      request.abort();
    }
    setActiveUploads((previous) => previous.filter((item) => item.id !== uploadId));
  };

  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-[#e8dbe0]">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
          Report Ingestion
        </h2>
      </div>

      <Dropzone onFilesSelected={handleFilesSelected} />

      <UploadProgressList
        activeUploads={activeUploads}
        onCancelUpload={handleRemoveUpload}
      />

      <RecentUploadsArchive
        documents={documents}
        isLoading={documentsLoading}
        error={documentsError}
        onRetry={loadDocuments}
      />
    </div>
  );
}
