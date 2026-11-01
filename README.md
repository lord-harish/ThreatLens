# ThreatLens

Cybersecurity Audit Intelligence & Decision Support System.

ThreatLens provides a cybersecurity audit dashboard, document upload and text extraction, and evidence-grounded AI-assisted security finding suggestions. AI suggestions remain pending human review; no vulnerability is treated as confirmed automatically.

## Key Modules
1. **Dashboard**: Database-backed report and finding totals, severity distribution, saved contextual risk distribution, and recent uploaded reports.
2. **Upload Reports**: Drag-and-drop document upload, extraction status, source-referenced text preview, and AI analysis actions.
3. **Audit Findings**: Human-reviewable, persisted AI findings with evidence excerpts and document references.
4. **Risk Analysis**: Evidence-backed contextual risk scores, factor completeness, reviewable inputs, and remediation priority ranking.
5. **AI Assistant**: Conversational answers grounded in indexed audit-report evidence with source citations.

## Technology Stack
- React 18 + Vite
- Python FastAPI document upload API
- PyMuPDF PDF extraction and python-docx DOCX extraction
- SQLite document metadata store
- Tailwind CSS
- Recharts
- Native System Font Stack

## Quick Start

Install the frontend dependencies and start the UI:

```bash
npm install
npm run dev
```

In another terminal, install the Python dependencies:

```bash
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Configure Gemini in the root `.env` file before starting FastAPI. Paste your key
after `GEMINI_API_KEY=`; `.env` is ignored by Git. The backend loads it at
startup. Alternatively, set these variables in the same PowerShell session:

```powershell
GEMINI_API_KEY=your-gemini-api-key
THREATLENS_LLM_PROVIDER=gemini
THREATLENS_LLM_MODEL=gemini-3.5-flash-lite
THREATLENS_LLM_TIMEOUT_SECONDS=30
THREATLENS_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
THREATLENS_CHROMA_DIR=backend/chroma
THREATLENS_RAG_CHUNK_SIZE=800
THREATLENS_RAG_CHUNK_OVERLAP=150
THREATLENS_RAG_TOP_K=5
THREATLENS_RAG_SIMILARITY_THRESHOLD=0.25
```

In PowerShell, environment variables can instead be set like this:

```powershell
$env:GEMINI_API_KEY = "your-gemini-api-key"
$env:THREATLENS_LLM_PROVIDER = "gemini"
$env:THREATLENS_LLM_MODEL = "gemini-3.5-flash-lite"
$env:THREATLENS_LLM_TIMEOUT_SECONDS = "30"
$env:THREATLENS_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
$env:THREATLENS_CHROMA_DIR = "backend/chroma"
$env:THREATLENS_RAG_CHUNK_SIZE = "800"
$env:THREATLENS_RAG_CHUNK_OVERLAP = "150"
$env:THREATLENS_RAG_TOP_K = "5"
$env:THREATLENS_RAG_SIMILARITY_THRESHOLD = "0.25"
$env:THREATLENS_RISK_WEIGHT_SEVERITY = "0.30"
$env:THREATLENS_RISK_WEIGHT_BUSINESS_IMPACT = "0.20"
$env:THREATLENS_RISK_WEIGHT_ASSET_CRITICALITY = "0.15"
$env:THREATLENS_RISK_WEIGHT_EXPOSURE = "0.15"
$env:THREATLENS_RISK_WEIGHT_RECURRENCE = "0.20"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, start the API with the project environment:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The Vite development proxy defaults to port 8001 to avoid conflicts with stale
FastAPI processes often left on port 8000. Start the updated API and frontend
in separate terminals:

```powershell
# Backend terminal
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001

# Frontend terminal
npm run dev
```

Stop an already running Vite development server and start it again after
changing the proxy target; Vite reads this setting at startup. Override the
target with `VITE_API_PROXY_TARGET` if FastAPI runs on a different port.

The provider defaults to Gemini; model and request timeout are configurable with
`THREATLENS_LLM_MODEL` and `THREATLENS_LLM_TIMEOUT_SECONDS` (5–120 seconds).
The Gemini API key is required only when running finding analysis or chat.
Extracted report text is sent to Gemini only when a user explicitly starts
analysis or asks a chat question. BGE embeddings are generated locally.

Open http://localhost:3000. The Vite development server proxies `/api` requests to
FastAPI on port 8001 by default. Uploaded documents are stored under `backend/uploads/`, and
metadata and upload status are stored in `backend/documents.sqlite3`. Set
`THREATLENS_UPLOAD_DIR`, `THREATLENS_DATABASE_PATH`, or the comma-separated
`THREATLENS_CORS_ORIGINS` environment variable to customize those locations and
allowed browser origins.

Run the API tests with:

```bash
python -m unittest discover -s backend/tests -v
```

### Document API

- `POST /api/documents/upload` — upload one PDF, DOCX, or TXT file (maximum 20 MB).
- `GET /api/documents` — list document metadata, current processing status, and each
  document's persisted non-rejected finding count.
- `POST /api/documents/{document_id}/extract` — extract text and return its status,
  error (if any), PDF page count, and extracted segment count.
- `GET /api/documents/{document_id}/status` — retrieve processing status and error.
- `GET /api/documents/{document_id}/extracted-text` — retrieve extracted text
  segments with page, paragraph/table reference, section, and exact stored text.
  Returns HTTP 409 until extraction completed successfully.
- `POST /api/documents/{document_id}/analyze` — send extracted text to the
  configured Gemini model in bounded chunks and store evidence-grounded finding
  suggestions. Requires `GEMINI_API_KEY` and successfully extracted text.
- `GET /api/documents/{document_id}/findings` — list findings for one document.
- `GET /api/findings?severity=High&category=Injection&document_id=...` — list
  findings with optional severity, category, and document filters.
- `GET /api/findings/{finding_id}` — retrieve one finding and its provenance.
- `PATCH /api/findings/{finding_id}` — edit supported finding fields, reviewer
  notes, or review state (`needs_review`, `confirmed`, `rejected`).
- `POST /api/rag/index/{document_id}` — chunk an extracted document, embed its
  content with the configured BGE model, and persist its vectors in ChromaDB.
  Add `?force=true` to reindex an unchanged report.
- `POST /api/rag/index-all` — index all successfully extracted documents.
- `GET /api/rag/index-status/{document_id}` — return indexing state, error,
  timestamp, embedding model, and stored chunk count.
- `POST /api/chat/ask` — retrieve relevant indexed evidence and generate a
  structured, source-grounded answer. JSON body: `question`, optional
  `conversation_id`, optional `document_ids` filter, optional `top_k`.
- `GET /api/chat/history/{conversation_id}` — retrieve persisted conversation
  messages and validated source citations.
- `DELETE /api/chat/history/{conversation_id}` — delete a persisted conversation.
- `DELETE /api/documents/{document_id}` — delete document metadata, extracted
  segments, findings, original upload, and associated Chroma vectors.

Supported statuses are `uploaded`, `extracting`, `extracted`, `failed`, and
`requires_ocr`. PDFs are parsed page by page with PyMuPDF, DOCX paragraphs and
table cells are read in document order with python-docx, and TXT supports UTF-8,
UTF-8 BOM, UTF-16 BOM, and Windows-1252 fallback decoding. Scanned PDFs are
marked `requires_ocr`; OCR is not run. Empty, encrypted, corrupted, or unsupported
documents receive an explicit failed status and error. The original upload is
never modified.

Extraction resource limits are 20 MB per input file, 500 PDF pages, 50 MB of
expanded DOCX content, and 10 million extracted text characters. Run the API tests
with `python -m unittest discover -s backend/tests -v`.

Analysis chunks contain at most 12,000 characters, with at most 100 chunks per
document and 50 returned candidates per chunk. Candidate evidence must be an
exact excerpt from the cited extracted-text segment; unsupported CVE, CWE, CVSS,
and compliance references are omitted. Analysis records include provider, model,
timestamp, field-level explicit/inferred/unknown provenance, confidence, and
uncertainty notes. Repeated analysis is idempotent and does not overwrite human
review.

RAG uses LangChain's recursive text splitter with tokenizer-based chunk sizing
(default 800 tokens, 150-token overlap), Sentence Transformers with
`BAAI/bge-small-en-v1.5`, and a persistent ChromaDB collection under
`backend/chroma/`. Configure `THREATLENS_EMBEDDING_MODEL`, `THREATLENS_CHROMA_DIR`,
`THREATLENS_RAG_CHUNK_SIZE`, `THREATLENS_RAG_CHUNK_OVERLAP`,
`THREATLENS_RAG_TOP_K`, and `THREATLENS_RAG_SIMILARITY_THRESHOLD`. The first
index operation downloads the embedding model if it is not already cached.
Chunk IDs and content hashes are deterministic; repeated indexing skips an
unchanged document, while changed content is upserted and stale chunks removed.
Chat citation IDs are checked against the exact retrieved chunk set before being
returned; statements without valid citations are omitted.

### Contextual risk scoring

The deterministic scoring engine is implemented in `backend/risk_engine.py`;
Gemini does not generate or modify scores. Defaults are severity 30%, business
impact 20%, asset criticality 15%, exposure 15%, and recurrence 20%. Configure
the corresponding `THREATLENS_RISK_WEIGHT_*` environment variables; every value
must be in the 0–1 range and the weights must sum to 1.0. The score is the
weighted average of known factors. When factors are missing, the average is
normalized over the known weights, marked provisional, and accompanied by a
completeness percentage.

Severity maps to Critical 100, High 80, Medium 60, Low 30, and Informational
10. Classifications are Critical (80–100), High (60–79.99), Medium
(40–59.99), and Low (0–39.99). Business impact is auto-scored only when its
field provenance is explicit or human-reviewed and its text matches the
documented rubric: catastrophic/complete outage 100; regulated or sensitive
customer data exposure/material financial loss 90; data breach, data
exfiltration, production outage, or significant financial loss 80; unauthorized
access, service disruption, denial of service, or compliance breach 60; and
explicitly limited/non-production impact 30. A phrase not in the rubric stays
unknown. Exposure is scored 100 only for explicit public/internet exposure and
25 for explicit restricted/internal-only exposure; conflicting or absent
statements remain unknown. Asset criticality has no inferred default and must
be supplied by a reviewer. Recurrence matches normalized finding title and
category across distinct non-rejected report IDs; duplicate mentions within one
report count once. The recurrence factor is `min(100, (report_count - 1) ×
100 / 3)`, so a single report scores 0 and four or more reports score 100.

Risk factors and score snapshots are stored in the existing SQLite database.
Manual factor edits require a rationale; changing severity, impact, title,
category, affected asset, or review state recalculates scores, and new finding
analysis scores all active findings to refresh recurrence. CVSS remains an
independent finding field and never contributes to contextual risk.

- `POST /api/risk/calculate/{finding_id}` — calculate and snapshot one finding.
- `POST /api/risk/calculate-all` — recalculate active findings, updating recurrence.
- `GET /api/risk/overview` — active finding counts, severity distribution, risk
  classes, score completeness counts, configured weights, and thresholds.
- `GET /api/risk/findings` — prioritized scores; optional `severity`, `category`,
  `document_id`, `risk_classification`, and `limit` filters.
- `GET /api/risk/findings/{finding_id}` — finding details and factor breakdown.
- `GET /api/risk/top-priorities` — prioritized findings; optional `limit`.
- `GET /api/risk/history/{finding_id}` — append-only score snapshots.
- `PATCH /api/risk/findings/{finding_id}/factors` — set or clear reviewed
  `business_impact`, `asset_criticality`, `exposure`, and `recurrence` values
  (0–100). Include `rationale` for any supplied numeric value; use `null` to
  clear a manual override.

### Security analytics and evidence citations

The Security Analytics page reads audit reports, non-rejected findings, stored
finding statuses, and Step 6 risk scores from SQLite. Category chart buckets map
recorded finding categories into the displayed categories; unrecognized or
missing categories are grouped as Other. Findings start with remediation status
`Open`; reviewers can update the status to `In Progress`, `Resolved`, or
`Risk Accepted` from the AI finding detail drawer. Rejected AI suggestions are
excluded from analytics.

Each analyzer-validated evidence excerpt is stored in `finding_evidence` with
its finding and source document IDs, exact excerpt, page/source reference,
analysis chunk ID, and character offsets into the extracted segment when
available. Existing excerpts are migrated only when they exactly match their
stored extraction segment. Missing or unmatched evidence is not fabricated and
is returned as unavailable.

- `GET /api/analytics/overview` — report, finding, critical, high-risk, open,
  and resolved counts.
- `GET /api/analytics/severity` — active findings grouped by severity.
- `GET /api/analytics/status` — active findings grouped by remediation status.
- `GET /api/analytics/risk-distribution` — active findings grouped by persisted
  Step 6 risk classification; unscored findings are not assigned a risk class.
- `GET /api/analytics/categories` — active findings grouped into the seven UI
  category buckets.
- `GET /api/analytics/top-priorities?limit=10` — highest contextual scores with
  status and evidence-availability indicators.
- `GET /api/findings/{finding_id}/evidence` — exact evidence records and source
  metadata for a finding. Returns an empty list when no verified citation is
  available and 404 for an unknown finding.
- `GET /api/documents/{document_id}/source` — streams the original upload by
  validated document ID; PDF source opens inline at its cited page, TXT opens
  inline as plain text, and DOCX is downloaded. The response never includes
  the server storage path.

No new frontend chart dependency is required: the analytics page uses the
existing Recharts installation. Run the application with the Quick Start
commands above. To verify the API and frontend:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
npm run build
```

In the UI, upload a report, extract it, and select **Analyze report**. Open
**Security Analytics** to review database-backed metrics and priority ordering.
Click a finding in the table to open its review drawer, verify the exact
supporting excerpt and source reference, then use **View Source Document** to
open or download the original file.
