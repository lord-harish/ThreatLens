const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function readErrorMessage(response, payload) {
  if (typeof payload?.detail === 'string') return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((issue) => issue.msg).join(', ');
  }
  return `Request failed with status ${response.status}.`;
}

function parseJsonResponse(status, contentType, responseText) {
  try {
    return JSON.parse(responseText);
  } catch {
    const responseType = contentType || 'unknown content type';
    const backendUnavailable = /ECONNREFUSED|ECONNRESET|proxy error|could not proxy/i.test(responseText);
    const hint = backendUnavailable
      ? ' Start FastAPI with: python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000.'
      : ' Check that the request is reaching the FastAPI /api endpoint.';
    throw new Error(
      `Document service returned a non-JSON response (HTTP ${status}, ${responseType}).${hint}`
    );
  }
}

export async function fetchDocuments() {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/documents`);
  } catch {
    throw new Error('Unable to connect to the document service. Check that the backend is running.');
  }

  const documents = parseJsonResponse(
    response.status,
    response.headers.get('content-type'),
    await response.text()
  );

  if (!response.ok) throw new Error(readErrorMessage(response, documents));
  if (!Array.isArray(documents)) throw new Error('The document service returned an invalid document list.');
  return documents;
}

async function fetchDocumentData(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Unable to connect to the document service. Check that the backend is running.');
  }

  const payload = parseJsonResponse(
    response.status,
    response.headers.get('content-type'),
    await response.text()
  );
  if (!response.ok) throw new Error(readErrorMessage(response, payload));
  return payload;
}

export function extractDocument(documentId) {
  return fetchDocumentData(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/extract`, {
    method: 'POST',
  });
}

export function getDocumentStatus(documentId) {
  return fetchDocumentData(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/status`);
}

export function getExtractedText(documentId) {
  return fetchDocumentData(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/extracted-text`
  );
}

export function analyzeDocument(documentId) {
  return fetchDocumentData(
    `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/analyze`,
    { method: 'POST' }
  );
}

export function fetchFindings(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.size ? `?${query.toString()}` : '';
  return fetchDocumentData(`${API_BASE_URL}/findings${suffix}`);
}

export function getFindingEvidence(findingId) {
  return fetchDocumentData(
    `${API_BASE_URL}/findings/${encodeURIComponent(findingId)}/evidence`
  );
}

export function getDocumentSourceUrl(documentId, pageNumber) {
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? `#page=${pageNumber}` : '';
  return `${API_BASE_URL}/documents/${encodeURIComponent(documentId)}/source${page}`;
}

export function fetchAnalyticsOverview() {
  return fetchDocumentData(`${API_BASE_URL}/analytics/overview`);
}

export function fetchAnalyticsSeverity() {
  return fetchDocumentData(`${API_BASE_URL}/analytics/severity`);
}

export function fetchAnalyticsStatus() {
  return fetchDocumentData(`${API_BASE_URL}/analytics/status`);
}

export function fetchAnalyticsRiskDistribution() {
  return fetchDocumentData(`${API_BASE_URL}/analytics/risk-distribution`);
}

export function fetchAnalyticsCategories() {
  return fetchDocumentData(`${API_BASE_URL}/analytics/categories`);
}

export function fetchAnalyticsTopPriorities(limit = 10) {
  const query = new URLSearchParams({ limit: String(limit) });
  return fetchDocumentData(`${API_BASE_URL}/analytics/top-priorities?${query}`);
}

export function updateFindingReview(findingId, updates) {
  return fetchDocumentData(`${API_BASE_URL}/findings/${encodeURIComponent(findingId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export function indexDocument(documentId, force = false) {
  const query = force ? '?force=true' : '';
  return fetchDocumentData(
    `${API_BASE_URL}/rag/index/${encodeURIComponent(documentId)}${query}`,
    { method: 'POST' }
  );
}

export function indexAllDocuments(force = false) {
  const query = force ? '?force=true' : '';
  return fetchDocumentData(`${API_BASE_URL}/rag/index-all${query}`, { method: 'POST' });
}

export function getRagIndexStatus(documentId) {
  return fetchDocumentData(
    `${API_BASE_URL}/rag/index-status/${encodeURIComponent(documentId)}`
  );
}

export function askChatQuestion(payload) {
  return fetchDocumentData(`${API_BASE_URL}/chat/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function getChatHistory(conversationId) {
  return fetchDocumentData(
    `${API_BASE_URL}/chat/history/${encodeURIComponent(conversationId)}`
  );
}

export function deleteChatHistory(conversationId) {
  return fetchDocumentData(
    `${API_BASE_URL}/chat/history/${encodeURIComponent(conversationId)}`,
    { method: 'DELETE' }
  );
}

export function deleteDocument(documentId) {
  return fetchDocumentData(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export function getRiskOverview() {
  return fetchDocumentData(`${API_BASE_URL}/risk/overview`);
}

export function calculateAllRiskScores() {
  return fetchDocumentData(`${API_BASE_URL}/risk/calculate-all`, { method: 'POST' });
}

export function fetchRiskFindings(filters = {}) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.size ? `?${query.toString()}` : '';
  return fetchDocumentData(`${API_BASE_URL}/risk/findings${suffix}`);
}

export function getRiskFinding(findingId) {
  return fetchDocumentData(`${API_BASE_URL}/risk/findings/${encodeURIComponent(findingId)}`);
}

export function getRiskHistory(findingId) {
  return fetchDocumentData(`${API_BASE_URL}/risk/history/${encodeURIComponent(findingId)}`);
}

export function updateRiskFactors(findingId, factors) {
  return fetchDocumentData(
    `${API_BASE_URL}/risk/findings/${encodeURIComponent(findingId)}/factors`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factors),
    }
  );
}

export function uploadDocument(file, onProgress) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', `${API_BASE_URL}/documents/upload`);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let payload;
      try {
        payload = parseJsonResponse(
          xhr.status,
          xhr.getResponseHeader('content-type'),
          xhr.responseText
        );
      } catch (error) {
        reject(error);
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(readErrorMessage({ status: xhr.status }, payload)));
        return;
      }
      resolve(payload);
    });
    xhr.addEventListener('error', () => {
      reject(new Error('Network error while uploading. Check that the backend is running and try again.'));
    });
    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload cancelled.', 'AbortError'));
    });
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}
