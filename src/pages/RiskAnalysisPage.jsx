import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  calculateAllRiskScores,
  fetchDocuments,
  fetchRiskFindings,
  getRiskHistory,
  getRiskOverview,
  updateRiskFactors,
} from '../api/documents';

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
const FACTOR_LABELS = {
  severity: 'Severity',
  business_impact: 'Business impact',
  asset_criticality: 'Asset criticality',
  exposure: 'Exposure',
  recurrence: 'Recurrence',
};
const EDITABLE_FACTORS = ['business_impact', 'asset_criticality', 'exposure', 'recurrence'];

function formatScore(value) {
  return typeof value === 'number' ? value.toFixed(2) : '—';
}

function riskColor(classification) {
  return {
    Critical: 'text-[#9f1239] bg-[#ffe4e6]',
    High: 'text-[#9a3412] bg-[#ffedd5]',
    Medium: 'text-[#854d0e] bg-[#fef9c3]',
    Low: 'text-[#0369a1] bg-[#e0f2fe]',
  }[classification] || 'text-slate-500 bg-slate-100';
}

function RiskBadge({ classification }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${riskColor(classification)}`}>
      {classification || 'Unscored'}
    </span>
  );
}

export function RiskAnalysisPage() {
  const [overview, setOverview] = useState(null);
  const [findings, setFindings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [filters, setFilters] = useState({ severity: '', risk_classification: '', document_id: '' });
  const [factorValues, setFactorValues] = useState({});
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingFactors, setSavingFactors] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let summary = await getRiskOverview();
      if (summary.unscored_count > 0) {
        await calculateAllRiskScores();
        summary = await getRiskOverview();
      }
      const [items, documentItems] = await Promise.all([
        fetchRiskFindings(filters),
        fetchDocuments(),
      ]);
      setOverview(summary);
      setFindings(items);
      setDocuments(documentItems);
      setSelected((current) => current && items.find((item) => item.id === current.id) || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters, revision]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      setFactorValues({});
      setRationale('');
      return;
    }
    getRiskHistory(selected.id)
      .then(setHistory)
      .catch((requestError) => setError(requestError.message));
    const overrides = selected.manual_factor_overrides || {};
    setFactorValues(Object.fromEntries(
      EDITABLE_FACTORS.map((factor) => [factor, overrides[factor]?.value ?? ''])
    ));
    setRationale(
      EDITABLE_FACTORS
        .map((factor) => selected.manual_factor_overrides?.[factor]?.rationale)
        .find(Boolean) || ''
    );
  }, [selected?.id, revision]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleRecalculate = async () => {
    setLoading(true);
    setError('');
    try {
      await calculateAllRiskScores();
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
      setLoading(false);
    }
  };

  const handleSaveFactors = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const values = Object.fromEntries(
      EDITABLE_FACTORS.map((factor) => [
        factor,
        factorValues[factor] === '' ? null : Number(factorValues[factor]),
      ])
    );
    if (Object.values(values).some((value) => value !== null) && !rationale.trim()) {
      setError('Add a rationale for manually supplied factor values.');
      return;
    }
    setSavingFactors(true);
    setError('');
    try {
      const updated = await updateRiskFactors(selected.id, { ...values, rationale: rationale || undefined });
      setSelected(updated);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingFactors(false);
    }
  };

  const severityTotal = overview
    ? Object.values(overview.severity_counts).reduce((total, count) => total + count, 0)
    : 0;
  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e8dbe0] pb-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900 font-mono">
            Contextual Risk Prioritization
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Deterministic factor scores from documented evidence and reviewed context; CVSS remains separate.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRecalculate}
          disabled={loading}
          className="border border-[#decdd4] bg-[#fbf7f8] px-3 py-1.5 text-xs font-mono text-slate-800 disabled:opacity-50"
        >
          {loading ? 'Calculating…' : 'Recalculate all scores'}
        </button>
      </header>

      {error && (
        <div role="alert" className="border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ['Findings', overview?.finding_count ?? '—'],
          ['Scored', overview?.scored_count ?? '—'],
          ['Average contextual risk', formatScore(overview?.average_contextual_risk)],
          ['Provisional scores', overview?.provisional_count ?? '—'],
        ].map(([label, value]) => (
          <div key={label} className="enterprise-card p-3">
            <p className="text-[10px] font-mono uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="enterprise-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-800">Finding severity counts</h3>
          <span className="text-[10px] text-slate-500">{severityTotal} active findings</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SEVERITIES.map((severity) => (
            <div key={severity} className="border border-[#eee2e7] px-2 py-2">
              <p className="text-[10px] text-slate-500">{severity}</p>
              <p className="font-mono text-sm font-bold text-slate-900">
                {overview?.severity_counts?.[severity] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f2e6eb] p-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase text-slate-800">Remediation priority ranking</h3>
            <p className="mt-1 text-[10px] text-slate-500">
              Weighted score; provisional values are normalized across known factors and show completeness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by severity"
              value={filters.severity}
              onChange={(event) => updateFilter('severity', event.target.value)}
              className="border border-[#decdd4] bg-white px-2 py-1 text-xs"
            >
              <option value="">All severities</option>
              {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
            </select>
            <select
              aria-label="Filter by risk class"
              value={filters.risk_classification}
              onChange={(event) => updateFilter('risk_classification', event.target.value)}
              className="border border-[#decdd4] bg-white px-2 py-1 text-xs"
            >
              <option value="">All risk classes</option>
              {['Critical', 'High', 'Medium', 'Low'].map((level) => <option key={level}>{level}</option>)}
            </select>
            <select
              aria-label="Filter by source document"
              value={filters.document_id}
              onChange={(event) => updateFilter('document_id', event.target.value)}
              className="max-w-52 border border-[#decdd4] bg-white px-2 py-1 text-xs"
            >
              <option value="">All documents</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>{document.original_filename}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && !findings.length ? (
          <p className="p-4 text-xs text-slate-500">Loading risk scores…</p>
        ) : !findings.length ? (
          <div className="p-5 text-center">
            {overview?.finding_count === 0 ? (
              <>
                <p className="text-sm font-medium text-slate-700">No findings are stored for risk scoring yet.</p>
                <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500">
                  Risk Analysis uses only findings saved in the document database.
                  Upload a report, extract its text, then analyze it to create persisted findings.
                </p>
                <div className="mt-3 flex justify-center gap-2">
                  <Link
                    to="/upload"
                    className="border border-[#decdd4] bg-[#fbf7f8] px-3 py-1.5 text-xs font-mono text-slate-800 hover:bg-white"
                  >
                    Open document uploads
                  </Link>
                  <Link
                    to="/findings"
                    className="border border-[#decdd4] bg-white px-3 py-1.5 text-xs font-mono text-slate-800 hover:bg-[#fbf7f8]"
                  >
                    View findings
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">
                  {hasActiveFilters ? 'No findings match these filters.' : 'No risk scores are available.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => setFilters({ severity: '', risk_classification: '', document_id: '' })}
                    className="mt-2 text-xs font-mono text-[#9f1239] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#f2e6eb]">
            {findings.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelected(item)}
                className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left hover:bg-[#fcf8fa] ${
                  selected?.id === item.id ? 'bg-[#fbf2f5]' : ''
                }`}
              >
                <span className="font-mono text-xs font-bold text-slate-500">#{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-1 block truncate text-[10px] text-slate-500">
                    {item.affected_asset || 'Asset not specified'} · {item.original_filename}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-right">
                    <span className="block font-mono text-sm font-bold text-slate-900">{formatScore(item.risk_score)}</span>
                    <span className="text-[9px] text-slate-500">{item.score_completeness}% complete</span>
                  </span>
                  <RiskBadge classification={item.risk_classification} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="enterprise-card space-y-3 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f2e6eb] pb-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{selected.title}</h3>
              <p className="mt-1 text-[10px] text-slate-500">
                {selected.original_filename} · {selected.source_reference}
                {selected.page_number ? ` · page ${selected.page_number}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <RiskBadge classification={selected.risk_classification} />
              <span className="font-mono text-lg font-bold">{formatScore(selected.risk_score)}</span>
              {selected.cvss_score && (
                <span className="text-[10px] text-slate-500">CVSS {selected.cvss_score} (separate)</span>
              )}
            </div>
          </div>

          {selected.is_provisional && (
            <p className="border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Provisional score: {selected.score_completeness}% factor weight is known. Missing: {selected.missing_factors.map((name) => FACTOR_LABELS[name]).join(', ')}.
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(selected.factor_breakdown).map(([name, factor]) => (
              <div key={name} className="border border-[#eee2e7] p-2">
                <div className="flex justify-between gap-1">
                  <span className="text-[10px] font-semibold text-slate-700">{FACTOR_LABELS[name]}</span>
                  <span className="font-mono text-[10px]">{factor.value ?? 'Unknown'}</span>
                </div>
                <p className="mt-1 text-[9px] text-slate-500">{Math.round(factor.weight * 100)}% weight · {factor.source}</p>
                <p className="mt-1 text-[10px] text-slate-700">{factor.rationale}</p>
                {factor.evidence && (
                  <p className="mt-1 border-l-2 border-[#decdd4] pl-1 text-[9px] text-slate-500">
                    {String(factor.evidence).slice(0, 180)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {selected.evidence_excerpt && (
            <blockquote className="border-l-2 border-[#9f1239] bg-[#fbf7f8] px-3 py-2 text-xs text-slate-700">
              {selected.evidence_excerpt}
            </blockquote>
          )}
          {selected.remediation && (
            <p className="text-xs text-slate-700"><strong>Recorded remediation:</strong> {selected.remediation}</p>
          )}

          <form onSubmit={handleSaveFactors} className="space-y-2 border-t border-[#f2e6eb] pt-3">
            <div>
              <h4 className="text-[11px] font-mono font-bold uppercase text-slate-800">Review factor inputs</h4>
              <p className="mt-1 text-[10px] text-slate-500">
                Enter a reviewed value from 0 to 100. Leave blank to use evidence-based scoring or clear a manual override.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {EDITABLE_FACTORS.map((factor) => (
                <label key={factor} className="text-[10px] text-slate-600">
                  {FACTOR_LABELS[factor]}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={factorValues[factor] ?? ''}
                    onChange={(event) => setFactorValues((values) => ({
                      ...values,
                      [factor]: event.target.value,
                    }))}
                    className="mt-1 block w-full border border-[#decdd4] px-2 py-1 text-xs"
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={rationale}
                onChange={(event) => setRationale(event.target.value)}
                maxLength={1000}
                placeholder="Reviewer rationale for supplied values"
                aria-label="Reviewer rationale"
                className="min-w-60 flex-1 border border-[#decdd4] px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={savingFactors}
                className="border border-[#decdd4] bg-[#fbf7f8] px-3 py-1 text-xs font-mono disabled:opacity-50"
              >
                {savingFactors ? 'Saving…' : 'Save reviewed factors'}
              </button>
            </div>
          </form>

          <details className="border-t border-[#f2e6eb] pt-2">
            <summary className="cursor-pointer text-xs font-mono text-slate-700">
              Score history ({history.length} snapshots)
            </summary>
            <div className="mt-2 space-y-1">
              {history.map((snapshot, index) => (
                <p key={`${snapshot.calculated_at}-${index}`} className="text-[10px] text-slate-500">
                  {snapshot.calculated_at} · {snapshot.score} ({snapshot.classification}) · {snapshot.score_completeness}% complete · {snapshot.calculation_trigger}
                </p>
              ))}
              {!history.length && <p className="text-[10px] text-slate-500">No prior score snapshots.</p>}
            </div>
          </details>
        </section>
      )}

      <section className="enterprise-card p-3">
        <h3 className="text-xs font-mono font-bold uppercase text-slate-800">Scoring method</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
          Score = Σ(factor value × configured weight), normalized over known factors when incomplete. Severity is mapped from the finding severity; recurrence counts distinct reports with the same normalized title and category; business impact is only auto-scored when explicitly documented or human-reviewed; asset criticality requires a manual value. Exposure uses explicit statements in the source excerpt. Unknown factors remain visible and make the result provisional.
        </p>
      </section>
    </div>
  );
}
