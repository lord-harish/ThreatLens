import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchDocuments,
  fetchFindings,
  getDocumentSourceUrl,
  getFindingEvidence,
  updateFindingReview,
} from '../../api/documents';
import { Drawer } from '../common/Drawer';
import { SeverityBadge } from '../common/Badge';

const SEVERITIES = ['All', 'Critical', 'High', 'Medium', 'Low', 'Informational'];
const STATUSES = ['All', 'Open', 'In Progress', 'Resolved', 'Risk Accepted'];

export function AiFindingsPanel() {
  const [searchParams] = useSearchParams();
  const [findings, setFindings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [severity, setSeverity] = useState(searchParams.get('severity') || 'All');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [status, setStatus] = useState(searchParams.get('status') || 'All');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [documentId, setDocumentId] = useState(searchParams.get('document_id') || 'All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState('');

  useEffect(() => {
    setDocumentId(searchParams.get('document_id') || 'All');
    setSeverity(searchParams.get('severity') || 'All');
    setCategory(searchParams.get('category') || 'All');
    setStatus(searchParams.get('status') || 'All');
    setSearch(searchParams.get('search') || '');
  }, [searchParams]);

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [findingData, documentData] = await Promise.all([
        fetchFindings(),
        fetchDocuments(),
      ]);
      setFindings(findingData);
      setDocuments(documentData);
      const requestedFindingId = searchParams.get('finding_id');
      if (requestedFindingId) {
        setSelected(findingData.find((finding) => finding.id === requestedFindingId) || null);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setEvidence([]);
      setEvidenceError('');
      return;
    }
    setDraft({
      ...selected,
      cve_ids_text: selected.cve_ids.join(', '),
      cwe_ids_text: selected.cwe_ids.join(', '),
      compliance_references_text: selected.compliance_references.join(', '),
    });
    setSaveError('');
  }, [selected]);

  useEffect(() => {
    if (!selected) return undefined;
    let active = true;
    setEvidenceLoading(true);
    setEvidenceError('');
    getFindingEvidence(selected.id)
      .then((items) => {
        if (active) setEvidence(items);
      })
      .catch((requestError) => {
        if (active) setEvidenceError(requestError.message);
      })
      .finally(() => {
        if (active) setEvidenceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.id]);

  const categories = useMemo(
    () => [...new Set(findings.map((finding) => finding.category).filter(Boolean))].sort(),
    [findings]
  );
  const filteredFindings = findings.filter((finding) => (
    (severity === 'All' || finding.severity === severity)
    && (category === 'All' || finding.category === category)
    && (documentId === 'All' || finding.document_id === documentId)
    && (status === 'All' || finding.status === status)
    && (!search || [
      finding.id,
      finding.title,
      finding.category,
      finding.affected_asset,
      finding.original_filename,
      finding.evidence_excerpt,
      ...(finding.cve_ids || []),
    ].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))
  ));

  const setDraftField = (field, value) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const handleSave = async () => {
    if (!selected || !draft) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const updated = await updateFindingReview(selected.id, {
        title: draft.title,
        description: draft.description || null,
        category: draft.category || null,
        severity: draft.severity,
        affected_asset: draft.affected_asset || null,
        business_impact: draft.business_impact || null,
        technical_impact: draft.technical_impact || null,
        exploitation_evidence: draft.exploitation_evidence || null,
        remediation: draft.remediation || null,
        cve_ids: parseList(draft.cve_ids_text),
        cwe_ids: parseList(draft.cwe_ids_text),
        cvss_score: draft.cvss_score || null,
        cvss_vector: draft.cvss_vector || null,
        compliance_references: parseList(draft.compliance_references_text),
        review_status: draft.review_status,
        status: draft.status,
        reviewer_notes: draft.reviewer_notes || null,
      });
      setFindings((previous) => previous.map((finding) =>
        finding.id === updated.id ? updated : finding
      ));
      setSelected(updated);
    } catch (requestError) {
      setSaveError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const visibleForSource = (documentId === 'All'
    ? findings
    : findings.filter((finding) => finding.document_id === documentId));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#e8dbe0]">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
            AI-Extracted Findings ({filteredFindings.length})
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            AI-generated suggestions require human verification; they are not confirmed vulnerabilities.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-[11px] font-mono text-[#0369a1] hover:underline"
        >
          Refresh
        </button>
      </div>

      <div className="enterprise-card p-3 rounded-xs flex flex-wrap items-center gap-2">
        <input
          aria-label="Search AI findings"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search finding, asset, evidence…"
          className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-xs"
        />
        <select
          aria-label="Filter AI findings by severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-xs"
        >
          {SEVERITIES.map((value) => (
            <option key={value} value={value}>{value === 'All' ? 'All severities' : value}</option>
          ))}
        </select>
        <select
          aria-label="Filter AI findings by status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-xs"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>{value === 'All' ? 'All statuses' : value}</option>
          ))}
        </select>
        <select
          aria-label="Filter AI findings by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-xs"
        >
          <option value="All">All categories</option>
          {categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select
          aria-label="Filter AI findings by document"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          className="px-2 py-1 rounded-xs border border-[#e8dbe0] bg-white text-xs max-w-full"
        >
          <option value="All">All documents</option>
          {documents.map((document) => (
            <option key={document.id} value={document.id}>{document.original_filename}</option>
          ))}
        </select>
      </div>

      {isLoading && <div className="enterprise-card p-5 text-xs text-slate-500">Loading AI findings…</div>}
      {error && (
        <div role="alert" className="enterprise-card p-4 text-xs text-[#9f1239]">
          {error}
          <button onClick={loadData} className="ml-3 underline">Retry</button>
        </div>
      )}
      {!isLoading && !error && (
        <div className="enterprise-card rounded-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="border-b border-[#e8dbe0] bg-[#faf5f7] text-slate-500 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-3 font-medium">Finding / Asset</th>
                  <th className="py-2.5 px-3 font-medium">Severity</th>
                  <th className="py-2.5 px-3 font-medium">Evidence source</th>
                  <th className="py-2.5 px-3 font-medium">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2e6eb]">
                {filteredFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    onClick={() => setSelected(finding)}
                    className="hover:bg-[#fcf8fa] cursor-pointer align-top"
                  >
                    <td className="py-2.5 px-3 min-w-56">
                      <div className="font-medium text-slate-900">{finding.title}</div>
                      <div className="font-mono text-[10px] text-slate-500 mt-1">
                        {finding.affected_asset || 'Asset not stated'}
                        {finding.category ? ` · ${finding.category}` : ''}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1 line-clamp-2">
                        {finding.evidence_excerpt}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <SeverityBadge severity={finding.severity} size="xs" />
                    </td>
                    <td className="py-2.5 px-3 min-w-40">
                      <div className="text-slate-800">{finding.original_filename}</div>
                      <div className="font-mono text-[10px] text-slate-500 mt-1">
                        {finding.page_number ? `Page ${finding.page_number}` : finding.source_reference}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`text-[10px] font-mono uppercase ${
                        finding.review_status === 'confirmed'
                          ? 'text-[#047857]'
                          : finding.review_status === 'rejected'
                            ? 'text-[#9f1239]'
                            : 'text-[#b45309]'
                      }`}>
                        {finding.review_status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredFindings.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-6 px-3 text-center text-xs text-slate-500">
                      {visibleForSource.length === 0
                        ? 'No AI findings yet. Extract and analyze an uploaded report first.'
                        : 'No findings match these filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && draft && (
        <Drawer
          isOpen
          onClose={() => setSelected(null)}
          title="AI finding · human review"
          subtitle={`${selected.id} · ${selected.model_name} · ${selected.original_filename}`}
          width="max-w-3xl"
          footer={(
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-500">
                Analysis {new Date(selected.processed_at).toLocaleString()}
              </span>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xs bg-[#0f172a] text-white text-xs font-mono disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save review'}
              </button>
            </div>
          )}
        >
          <div className="p-2 rounded-xs bg-[#fff7ed] border border-[#fed7aa] text-xs text-[#9a3412]">
            This is an AI-generated suggestion, not a confirmed vulnerability. Verify the source before acting.
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField draft={draft} field="title" label="Finding title" onChange={setDraftField} />
            <SelectField
              draft={draft}
              field="severity"
              label="Severity"
              options={SEVERITIES.slice(1)}
              onChange={setDraftField}
            />
            <TextField draft={draft} field="category" label="Category" onChange={setDraftField} />
            <TextField draft={draft} field="affected_asset" label="Affected asset" onChange={setDraftField} />
            <TextField draft={draft} field="description" label="Description" multiline onChange={setDraftField} />
            <TextField draft={draft} field="business_impact" label="Business impact" multiline onChange={setDraftField} />
            <TextField draft={draft} field="technical_impact" label="Technical impact" multiline onChange={setDraftField} />
            <TextField draft={draft} field="exploitation_evidence" label="Exploitation details" multiline onChange={setDraftField} />
            <TextField draft={draft} field="remediation" label="Remediation recommendation" multiline onChange={setDraftField} />
            <TextField draft={draft} field="cve_ids_text" label="CVE IDs (comma-separated)" onChange={setDraftField} />
            <TextField draft={draft} field="cwe_ids_text" label="CWE IDs (comma-separated)" onChange={setDraftField} />
            <TextField draft={draft} field="cvss_score" label="CVSS score (source-stated only)" onChange={setDraftField} />
            <TextField draft={draft} field="cvss_vector" label="CVSS vector (source-stated only)" onChange={setDraftField} />
            <TextField draft={draft} field="compliance_references_text" label="Compliance references (comma-separated)" onChange={setDraftField} />
            <SelectField
              draft={draft}
              field="review_status"
              label="Human review status"
              options={['needs_review', 'confirmed', 'rejected']}
              onChange={setDraftField}
            />
            <SelectField
              draft={draft}
              field="status"
              label="Remediation status"
              options={['Open', 'In Progress', 'Resolved', 'Risk Accepted']}
              onChange={setDraftField}
            />
            <TextField draft={draft} field="reviewer_notes" label="Reviewer notes" multiline onChange={setDraftField} />
          </div>
          <section className="p-3 rounded-xs bg-[#fbf7f8] border border-[#e8dbe0] space-y-2">
            <div className="text-[10px] font-mono uppercase font-semibold text-slate-500">
              Evidence citations · {selected.title} · {selected.severity}
            </div>
            {draft.remediation && (
              <p className="text-xs text-slate-700">
                <strong>Recommendation:</strong> {draft.remediation}
              </p>
            )}
            {evidenceLoading && <p className="text-xs text-slate-500">Loading source evidence…</p>}
            {evidenceError && (
              <p role="alert" className="text-xs text-rose-700">{evidenceError}</p>
            )}
            {!evidenceLoading && !evidenceError && evidence.length === 0 && (
              <p className="text-xs text-slate-500">Evidence unavailable.</p>
            )}
            {evidence.map((citation) => (
              <article key={citation.evidence_id} className="space-y-2 border-t border-[#e8dbe0] pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
                  <span>
                    {citation.source_document_filename}
                    {' · '}
                    {citation.page_number ? `Page ${citation.page_number}` : 'Page unavailable'}
                    {citation.source_reference ? ` · ${citation.source_reference}` : ''}
                  </span>
                  <a
                    href={getDocumentSourceUrl(citation.source_document_id, citation.page_number)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="border border-[#decdd4] bg-white px-2 py-1 font-mono text-[#0369a1] hover:bg-[#fbf7f8]"
                  >
                    View Source Document
                  </a>
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs font-sans text-slate-800">
                  {citation.evidence_excerpt || 'Evidence unavailable.'}
                </pre>
                {(citation.start_offset !== null || citation.chunk_id) && (
                  <div className="text-[9px] font-mono text-slate-500">
                    {citation.start_offset !== null
                      ? `Character offsets ${citation.start_offset}–${citation.end_offset}`
                      : ''}
                    {citation.chunk_id ? ` · Analysis chunk ${citation.chunk_id}` : ''}
                  </div>
                )}
              </article>
            ))}
          </section>
          <div className="grid sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-2 border border-[#e8dbe0] rounded-xs">
              <div className="font-mono uppercase text-slate-500 mb-1">Field provenance</div>
              {Object.entries(selected.field_provenance).map(([field, source]) => (
                <div key={field}>{field}: <span className="font-mono">{source}</span></div>
              ))}
            </div>
            <div className="p-2 border border-[#e8dbe0] rounded-xs">
              <div className="font-mono uppercase text-slate-500 mb-1">
                Confidence {Math.round(selected.confidence * 100)}%
              </div>
              {selected.uncertainty_notes.length
                ? selected.uncertainty_notes.map((note) => <div key={note}>• {note}</div>)
                : <div>No uncertainty notes returned.</div>}
            </div>
          </div>
          {saveError && <div role="alert" className="text-xs text-[#9f1239]">{saveError}</div>}
        </Drawer>
      )}
    </section>
  );
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function TextField({ draft, field, label, onChange, multiline = false }) {
  const Component = multiline ? 'textarea' : 'input';
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase text-slate-500">
        {label}
        {draft.field_provenance?.[field] && ` · ${draft.field_provenance[field]}`}
      </span>
      <Component
        value={draft[field] ?? ''}
        onChange={(event) => onChange(field, event.target.value)}
        rows={multiline ? 3 : undefined}
        className="w-full px-2 py-1.5 text-xs border border-[#decdd4] rounded-xs bg-white text-slate-800 focus:outline-none focus:border-[#0369a1]"
      />
    </label>
  );
}

function SelectField({ draft, field, label, options, onChange }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-mono uppercase text-slate-500">{label}</span>
      <select
        value={draft[field] || ''}
        onChange={(event) => onChange(field, event.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-[#decdd4] rounded-xs bg-white text-slate-800"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>
        ))}
      </select>
    </label>
  );
}
