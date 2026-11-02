import logging
import json
import math
import os
import re
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
import sqlite3
from typing import Literal
from uuid import uuid4

from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from backend.analyzer import AnalysisError, Severity, analyze_segments, store_finding
from backend.extraction import ExtractionError, extract_document
from backend.rag import (
    MAX_TOP_K,
    RagError,
    answer_question,
    delete_document_vectors,
    document_fingerprint,
    index_configuration,
    index_document_data,
    retrieve_chunks,
)
from backend.risk_engine import (
    OVERRIDABLE_FACTORS,
    RISK_THRESHOLDS,
    RiskEngineError,
    configured_weights,
    initialize_risk_schema,
    recurrence_report_count,
    score_finding,
)


logger = logging.getLogger(__name__)
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
}
UPLOAD_DIR = Path(os.getenv("THREATLENS_UPLOAD_DIR", Path(__file__).parent / "uploads"))
DATABASE_PATH = Path(os.getenv("THREATLENS_DATABASE_PATH", Path(__file__).parent / "documents.sqlite3"))


class FindingReviewPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=8000)
    description: str | None = Field(default=None, max_length=8000)
    category: str | None = Field(default=None, max_length=500)
    severity: Severity | None = None
    affected_asset: str | None = Field(default=None, max_length=1000)
    business_impact: str | None = Field(default=None, max_length=8000)
    technical_impact: str | None = Field(default=None, max_length=8000)
    exploitation_evidence: str | None = Field(default=None, max_length=8000)
    remediation: str | None = Field(default=None, max_length=8000)
    cve_ids: list[str] | None = Field(default=None, max_length=50)
    cwe_ids: list[str] | None = Field(default=None, max_length=50)
    cvss_score: str | None = Field(default=None, max_length=20)
    cvss_vector: str | None = Field(default=None, max_length=500)
    compliance_references: list[str] | None = Field(default=None, max_length=50)
    review_status: Literal["needs_review", "confirmed", "rejected"] | None = None
    status: Literal["Open", "In Progress", "Resolved", "Risk Accepted"] | None = None
    reviewer_notes: str | None = Field(default=None, max_length=4000)


class ChatAskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=4000)
    conversation_id: str | None = Field(default=None, min_length=1, max_length=64)
    document_ids: list[str] | None = Field(default=None, max_length=50)
    top_k: int | None = Field(default=None, ge=1, le=MAX_TOP_K)


class RiskFactorPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_impact: float | None = Field(default=None, ge=0, le=100)
    asset_criticality: float | None = Field(default=None, ge=0, le=100)
    exposure: float | None = Field(default=None, ge=0, le=100)
    recurrence: float | None = Field(default=None, ge=0, le=100)
    rationale: str | None = Field(default=None, min_length=1, max_length=1000)

    @field_validator(*OVERRIDABLE_FACTORS, mode="before")
    @classmethod
    def validate_finite_factor(cls, value):
        if value is not None and (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
        ):
            raise ValueError("Factor values must be finite numbers from 0 to 100.")
        return value

    @model_validator(mode="after")
    def validate_factor_patch(self):
        factor_fields = set(self.model_fields_set) & set(OVERRIDABLE_FACTORS)
        if not factor_fields:
            raise ValueError("Provide at least one factor value to update or clear.")
        values = [getattr(self, name) for name in factor_fields]
        if any(value is not None for value in values) and (
            not self.rationale or not self.rationale.strip()
        ):
            raise ValueError("A rationale is required for manual factor values.")
        return self


app = FastAPI(title="ThreatLens AI Document API")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "THREATLENS_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


def initialize_database():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        with connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    original_filename TEXT NOT NULL,
                    server_filename TEXT NOT NULL UNIQUE,
                    extension TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    extraction_error TEXT,
                    extracted_at TEXT,
                    extraction_page_count INTEGER,
                    analysis_status TEXT NOT NULL DEFAULT 'not_analyzed',
                    analysis_error TEXT,
                    analysis_provider TEXT,
                    analysis_model TEXT,
                    analyzed_at TEXT
                )
                """
            )
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(documents)").fetchall()
            }
            for name, column_type in (
                ("extraction_error", "TEXT"),
                ("extracted_at", "TEXT"),
                ("extraction_page_count", "INTEGER"),
                ("analysis_status", "TEXT NOT NULL DEFAULT 'not_analyzed'"),
                ("analysis_error", "TEXT"),
                ("analysis_provider", "TEXT"),
                ("analysis_model", "TEXT"),
                ("analyzed_at", "TEXT"),
                ("rag_status", "TEXT NOT NULL DEFAULT 'not_indexed'"),
                ("rag_error", "TEXT"),
                ("rag_indexed_at", "TEXT"),
                ("rag_content_hash", "TEXT"),
                ("rag_model", "TEXT"),
            ):
                if name not in columns:
                    connection.execute(f"ALTER TABLE documents ADD COLUMN {name} {column_type}")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS document_extraction_segments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    sequence_index INTEGER NOT NULL,
                    page_number INTEGER,
                    source_reference TEXT NOT NULL,
                    section_reference TEXT,
                    extracted_text TEXT NOT NULL,
                    UNIQUE(document_id, sequence_index)
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL REFERENCES chat_conversations(id),
                    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                    content TEXT NOT NULL,
                    citations_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS findings (
                    id TEXT PRIMARY KEY,
                    document_id TEXT NOT NULL REFERENCES documents(id),
                    title TEXT NOT NULL,
                    description TEXT,
                    category TEXT,
                    severity TEXT NOT NULL,
                    affected_asset TEXT,
                    business_impact TEXT,
                    technical_impact TEXT,
                    exploitation_evidence TEXT,
                    remediation TEXT,
                    cve_ids_json TEXT NOT NULL,
                    cwe_ids_json TEXT NOT NULL,
                    cvss_score TEXT,
                    cvss_vector TEXT,
                    compliance_references_json TEXT NOT NULL,
                    source_reference TEXT NOT NULL,
                    page_number INTEGER,
                    evidence_excerpt TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    uncertainty_notes_json TEXT NOT NULL,
                    field_provenance_json TEXT NOT NULL,
                    model_name TEXT NOT NULL,
                    provider_name TEXT NOT NULL,
                    processed_at TEXT NOT NULL,
                    review_status TEXT NOT NULL DEFAULT 'needs_review',
                    reviewer_notes TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            finding_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(findings)").fetchall()
            }
            if "status" not in finding_columns:
                connection.execute(
                    "ALTER TABLE findings ADD COLUMN status TEXT NOT NULL DEFAULT 'Open'"
                )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS finding_evidence (
                    id TEXT PRIMARY KEY,
                    finding_id TEXT NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
                    source_document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    page_number INTEGER,
                    source_reference TEXT NOT NULL,
                    evidence_excerpt TEXT NOT NULL,
                    chunk_id TEXT,
                    start_offset INTEGER,
                    end_offset INTEGER,
                    created_at TEXT NOT NULL,
                    UNIQUE (
                        finding_id, source_document_id, source_reference, evidence_excerpt
                    )
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TEXT NOT NULL
                )
                """
            )
            evidence_migration = connection.execute(
                "SELECT 1 FROM schema_migrations WHERE version = 'finding-evidence-v1'"
            ).fetchone()
            if evidence_migration is None:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO finding_evidence (
                        id, finding_id, source_document_id, page_number, source_reference,
                        evidence_excerpt, chunk_id, start_offset, end_offset, created_at
                    )
                    SELECT f.id || '-evidence-legacy', f.id, f.document_id, f.page_number,
                           f.source_reference, f.evidence_excerpt, NULL,
                           instr(s.extracted_text, f.evidence_excerpt) - 1,
                           instr(s.extracted_text, f.evidence_excerpt) - 1
                               + length(f.evidence_excerpt),
                           f.created_at
                    FROM findings AS f
                    JOIN document_extraction_segments AS s
                      ON s.document_id = f.document_id
                     AND s.source_reference = f.source_reference
                     AND s.page_number IS f.page_number
                    WHERE length(trim(f.evidence_excerpt)) > 0
                      AND instr(s.extracted_text, f.evidence_excerpt) > 0
                    """
                )
                connection.execute(
                    """
                    INSERT INTO schema_migrations (version, applied_at)
                    VALUES ('finding-evidence-v1', ?)
                    """,
                    (datetime.now(timezone.utc).isoformat(timespec="seconds"),),
                )
            initialize_risk_schema(connection)


def get_document(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            """
            SELECT id, original_filename, extension, mime_type, size_bytes, status, uploaded_at,
                   extraction_error, extracted_at, extraction_page_count,
                   analysis_status, analysis_error, analysis_provider, analysis_model, analyzed_at,
                   rag_status, rag_error, rag_indexed_at, rag_model
            FROM documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()
    return dict(row) if row is not None else None


def get_documents():
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT d.id, d.original_filename, d.extension, d.mime_type, d.size_bytes,
                   d.status, d.uploaded_at,
                   (
                       SELECT COUNT(*) FROM findings AS f
                       WHERE f.document_id = d.id AND f.review_status != 'rejected'
                   ) AS finding_count,
                   d.extraction_error, d.extracted_at, d.extraction_page_count,
                   d.analysis_status, d.analysis_error, d.analysis_provider, d.analysis_model, d.analyzed_at,
                   d.rag_status, d.rag_error, d.rag_indexed_at, d.rag_model
            FROM documents AS d ORDER BY d.uploaded_at DESC, d.id DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/documents/upload", status_code=201)
async def upload_document(file: UploadFile = File(...)):
    initialize_database()

    supplied_filename = file.filename or ""
    original_filename = PureWindowsPath(supplied_filename.replace("/", "\\")).name
    extension = Path(original_filename).suffix.lower()
    if not original_filename or extension not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload a PDF, DOCX, or TXT document.",
        )

    mime_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if mime_type != ALLOWED_MIME_TYPES[extension]:
        raise HTTPException(
            status_code=415,
            detail=f"File type {extension} requires MIME type {ALLOWED_MIME_TYPES[extension]}.",
        )

    document_id = str(uuid4())
    server_filename = f"{uuid4().hex}{extension}"
    temporary_path = UPLOAD_DIR / f".{uuid4().hex}.tmp"
    stored_path = UPLOAD_DIR / server_filename
    size_bytes = 0

    try:
        file_too_large = False
        with temporary_path.open("xb") as destination:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size_bytes += len(chunk)
                if size_bytes > MAX_FILE_SIZE:
                    file_too_large = True
                    break
                destination.write(chunk)

        if file_too_large:
            temporary_path.unlink()
            raise HTTPException(
                status_code=413,
                detail="File exceeds the 20 MB per-file limit.",
            )
        if size_bytes == 0:
            temporary_path.unlink()
            raise HTTPException(status_code=400, detail="Empty files cannot be uploaded.")

        temporary_path.replace(stored_path)
        uploaded_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                connection.execute(
                    """
                    INSERT INTO documents (
                        id, original_filename, server_filename, extension, mime_type,
                        size_bytes, status, uploaded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        document_id,
                        original_filename,
                        server_filename,
                        extension,
                        mime_type,
                        size_bytes,
                        "uploaded",
                        uploaded_at,
                    ),
                )
    except HTTPException:
        raise
    except (OSError, sqlite3.Error) as error:
        for path in (temporary_path, stored_path):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        logger.exception("Unable to store uploaded document")
        raise HTTPException(
            status_code=500,
            detail="Unable to store the uploaded document.",
        ) from error
    finally:
        await file.close()

    return get_document(document_id)


@app.get("/api/documents")
def list_documents():
    initialize_database()
    return get_documents()


def _get_document_for_extraction(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            """
            SELECT id, original_filename, server_filename, extension, size_bytes, status
            FROM documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()


def _set_extraction_status(document_id, status, error=None, page_count=None, segments=None):
    extracted_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            connection.execute(
                """
                UPDATE documents
                SET status = ?, extraction_error = ?, extracted_at = ?,
                    extraction_page_count = ?
                WHERE id = ?
                """,
                (status, error, extracted_at, page_count, document_id),
            )
            if segments is not None:
                connection.execute(
                    "DELETE FROM document_extraction_segments WHERE document_id = ?",
                    (document_id,),
                )
                connection.executemany(
                    """
                    INSERT INTO document_extraction_segments (
                        document_id, sequence_index, page_number, source_reference,
                        section_reference, extracted_text
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            document_id,
                            index,
                            segment["page_number"],
                            segment["source_reference"],
                            segment["section_reference"],
                            segment["extracted_text"],
                        )
                        for index, segment in enumerate(segments)
                    ],
                )


def _claim_extraction(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            cursor = connection.execute(
                """
                UPDATE documents
                SET status = 'extracting', extraction_error = NULL,
                    extracted_at = NULL, extraction_page_count = NULL
                WHERE id = ? AND status != 'extracting'
                """,
                (document_id,),
            )
            return cursor.rowcount == 1


def _stored_document_path(server_filename):
    if not re.fullmatch(r"[0-9a-f]{32}\.(pdf|docx|txt)", server_filename):
        raise ExtractionError("Stored document metadata is invalid.")
    upload_root = UPLOAD_DIR.resolve()
    stored_path = (upload_root / server_filename).resolve()
    if stored_path.parent != upload_root:
        raise ExtractionError("Stored document path is invalid.")
    return stored_path


@app.post("/api/documents/{document_id}/extract")
def extract_uploaded_document(document_id: str):
    initialize_database()
    document = _get_document_for_extraction(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not _claim_extraction(document_id):
        if get_document(document_id) is None:
            raise HTTPException(status_code=404, detail="Document not found.")
        raise HTTPException(status_code=409, detail="Document extraction is already in progress.")

    try:
        if get_document(document_id)["rag_status"] != "not_indexed":
            delete_document_vectors(document_id)
            with closing(sqlite3.connect(DATABASE_PATH)) as connection:
                with connection:
                    connection.execute(
                        """
                        UPDATE documents
                        SET rag_status = 'not_indexed', rag_error = NULL,
                            rag_indexed_at = NULL, rag_content_hash = NULL, rag_model = NULL
                        WHERE id = ?
                        """,
                        (document_id,),
                    )
        stored_path = _stored_document_path(document["server_filename"])
        if not stored_path.is_file():
            raise ExtractionError("The uploaded document is missing from storage.")
        if stored_path.stat().st_size != document["size_bytes"]:
            raise ExtractionError("The stored document size does not match its metadata.")
        with stored_path.open("rb") as source:
            data = source.read(20 * 1024 * 1024 + 1)

        segments, status, error, page_count = extract_document(data, document["extension"])
        _set_extraction_status(
            document_id,
            status,
            error=error,
            page_count=page_count,
            segments=segments,
        )
    except ExtractionError as error:
        _set_extraction_status(document_id, error.status, error=str(error))
    except (OSError, sqlite3.Error) as error:
        _set_extraction_status(document_id, "failed", error="Unable to read or store extracted text.")
        logger.exception("Document extraction failed for %s", document_id)
        raise HTTPException(
            status_code=500,
            detail="Unable to read or store extracted text.",
        ) from error
    except RagError as error:
        _set_extraction_status(document_id, "failed", error=str(error))
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception:
        _set_extraction_status(
            document_id,
            "failed",
            error="An unexpected error occurred during extraction. Check the API logs.",
        )
        logger.exception("Unexpected document extraction error for %s", document_id)

    result = get_document(document_id)
    return {
        "document_id": document_id,
        "status": result["status"],
        "error": result["extraction_error"],
        "extracted_at": result["extracted_at"],
        "page_count": result["extraction_page_count"],
        "segment_count": _get_segment_count(document_id),
    }


def _get_segment_count(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        row = connection.execute(
            "SELECT COUNT(*) FROM document_extraction_segments WHERE document_id = ?",
            (document_id,),
        ).fetchone()
    return row[0]


@app.get("/api/documents/{document_id}/status")
def get_document_status(document_id: str):
    initialize_database()
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "document_id": document["id"],
        "status": document["status"],
        "error": document["extraction_error"],
        "extracted_at": document["extracted_at"],
        "page_count": document["extraction_page_count"],
        "analysis_status": document["analysis_status"],
        "analysis_error": document["analysis_error"],
        "analysis_provider": document["analysis_provider"],
        "analysis_model": document["analysis_model"],
        "analyzed_at": document["analyzed_at"],
        "rag_status": document["rag_status"],
        "rag_error": document["rag_error"],
        "rag_indexed_at": document["rag_indexed_at"],
        "rag_model": document["rag_model"],
    }


@app.get("/api/documents/{document_id}/extracted-text")
def get_extracted_text(document_id: str):
    initialize_database()
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document["status"] != "extracted":
        raise HTTPException(
            status_code=409,
            detail=document["extraction_error"] or f"Document status is {document['status']}.",
        )

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT sequence_index, page_number, source_reference,
                   section_reference, extracted_text
            FROM document_extraction_segments
            WHERE document_id = ?
            ORDER BY sequence_index
            """,
            (document_id,),
        ).fetchall()
    segments = [dict(row) for row in rows]
    return {
        "document_id": document_id,
        "original_filename": document["original_filename"],
        "extension": document["extension"],
        "status": document["status"],
        "page_count": document["extraction_page_count"],
        "segments": segments,
        "text": "\n\n".join(segment["extracted_text"] for segment in segments),
    }


def _set_analysis_status(document_id, status, error=None, provider=None, model=None, analyzed_at=None):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            connection.execute(
                """
                UPDATE documents
                SET analysis_status = ?, analysis_error = ?, analysis_provider = ?,
                    analysis_model = ?, analyzed_at = ?
                WHERE id = ?
                """,
                (status, error, provider, model, analyzed_at, document_id),
            )


def _claim_analysis(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            cursor = connection.execute(
                """
                UPDATE documents
                SET analysis_status = 'processing', analysis_error = NULL
                WHERE id = ? AND status = 'extracted'
                  AND analysis_status NOT IN ('processing', 'analyzed')
                """,
                (document_id,),
            )
            return cursor.rowcount == 1


def _row_to_finding(row):
    finding = dict(row)
    for column, key in (
        ("cve_ids_json", "cve_ids"),
        ("cwe_ids_json", "cwe_ids"),
        ("compliance_references_json", "compliance_references"),
        ("uncertainty_notes_json", "uncertainty_notes"),
        ("field_provenance_json", "field_provenance"),
    ):
        finding[key] = json.loads(finding.pop(column))
    finding["original_filename"] = finding.pop("document_filename")
    return finding


def _query_findings(where_clause="", parameters=(), limit=200):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"""
            SELECT f.*, d.original_filename AS document_filename
            FROM findings AS f
            JOIN documents AS d ON d.id = f.document_id
            {where_clause}
            ORDER BY f.created_at DESC, f.id DESC
            LIMIT ?
            """,
            (*parameters, limit),
        ).fetchall()
    return [_row_to_finding(row) for row in rows]


@app.post("/api/documents/{document_id}/analyze")
def analyze_document_findings(document_id: str):
    initialize_database()
    document = _get_document_for_extraction(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        analysis_data = connection.execute(
            """
            SELECT status, analysis_status, analysis_provider, analysis_model,
                   analyzed_at, analysis_error
            FROM documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()

    if analysis_data["status"] != "extracted":
        raise HTTPException(
            status_code=409,
            detail="Extract document text successfully before analyzing findings.",
        )
    if analysis_data["analysis_status"] == "analyzed":
        existing = _query_findings("WHERE f.document_id = ?", (document_id,), limit=500)
        return {
            "document_id": document_id,
            "status": "analyzed",
            "model_name": analysis_data["analysis_model"],
            "provider": analysis_data["analysis_provider"],
            "processed_at": analysis_data["analyzed_at"],
            "finding_count": len(existing),
            "already_analyzed": True,
        }
    try:
        configured_weights()
    except RiskEngineError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    if not _claim_analysis(document_id):
        raise HTTPException(status_code=409, detail="Finding analysis is already in progress.")

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT page_number, source_reference, section_reference, extracted_text
            FROM document_extraction_segments
            WHERE document_id = ?
            ORDER BY sequence_index
            """,
            (document_id,),
        ).fetchall()
    segments = [dict(row) for row in rows]

    try:
        result = analyze_segments(segments)
        findings = result["findings"]
        processed_at = result["processed_at"]
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                for finding in findings:
                    store_finding(
                        connection,
                        {"id": document_id},
                        finding,
                        result["model_name"],
                        result["provider"],
                        processed_at,
                    )
                connection.execute(
                    """
                    UPDATE documents
                    SET analysis_status = 'analyzed', analysis_error = NULL,
                        analysis_provider = ?, analysis_model = ?, analyzed_at = ?
                    WHERE id = ?
                    """,
                    (
                        result["provider"],
                        result["model_name"],
                        processed_at,
                        document_id,
                    ),
                )
    except AnalysisError as error:
        _set_analysis_status(document_id, "failed", error=str(error))
        raise HTTPException(status_code=503, detail=str(error)) from error
    except sqlite3.Error as error:
        _set_analysis_status(document_id, "failed", error="Unable to store analyzed findings.")
        logger.exception("Unable to persist findings for document %s", document_id)
        raise HTTPException(status_code=500, detail="Unable to store analyzed findings.") from error
    except Exception as error:
        _set_analysis_status(
            document_id,
            "failed",
            error="Finding analysis failed unexpectedly. Check the API logs.",
        )
        logger.exception("Unexpected finding analysis error for document %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Finding analysis failed unexpectedly. Check the API logs.",
        )

    try:
        scored_findings = _calculate_risk_batch(
            _risk_source_findings(),
            "finding_analysis",
        )
    except RiskEngineError as error:
        logger.exception("Unable to calculate risk scores after analyzing document %s", document_id)
        raise HTTPException(status_code=500, detail=str(error)) from error

    return {
        "document_id": document_id,
        "status": "analyzed",
        "provider": result["provider"],
        "model_name": result["model_name"],
        "processed_at": processed_at,
        "chunks_processed": result["chunks_processed"],
        "finding_count": len(findings),
        "risk_scores_updated": len(scored_findings),
        "already_analyzed": False,
    }


@app.get("/api/documents/{document_id}/findings")
def get_document_findings(document_id: str):
    initialize_database()
    if get_document(document_id) is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _query_findings("WHERE f.document_id = ?", (document_id,), limit=500)


@app.get("/api/findings")
def list_findings(
    severity: str | None = None,
    category: str | None = None,
    document_id: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
):
    initialize_database()
    filters = []
    parameters = []
    if severity:
        filters.append("f.severity = ?")
        parameters.append(severity)
    if category:
        filters.append("LOWER(f.category) = LOWER(?)")
        parameters.append(category)
    if document_id:
        filters.append("f.document_id = ?")
        parameters.append(document_id)
    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    return _query_findings(where_clause, parameters, limit)


@app.get("/api/findings/{finding_id}")
def get_finding(finding_id: str):
    initialize_database()
    findings = _query_findings("WHERE f.id = ?", (finding_id,), limit=1)
    if not findings:
        raise HTTPException(status_code=404, detail="Finding not found.")
    return findings[0]


@app.get("/api/analytics/overview")
def get_analytics_overview():
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM documents) AS total_reports,
                COUNT(*) AS total_findings,
                SUM(CASE WHEN f.severity = 'Critical' THEN 1 ELSE 0 END) AS critical_findings,
                SUM(CASE WHEN r.classification IN ('Critical', 'High') THEN 1 ELSE 0 END)
                    AS high_risk_findings,
                SUM(CASE WHEN f.status = 'Open' THEN 1 ELSE 0 END) AS open_findings,
                SUM(CASE WHEN f.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_findings
            FROM findings AS f
            LEFT JOIN risk_scores AS r ON r.finding_id = f.id
            WHERE f.review_status != 'rejected'
            """
        ).fetchone()
    return {
        key: row[key] or 0
        for key in (
            "total_reports",
            "total_findings",
            "critical_findings",
            "high_risk_findings",
            "open_findings",
            "resolved_findings",
        )
    }


@app.get("/api/analytics/severity")
def get_analytics_severity():
    initialize_database()
    values = {severity: 0 for severity in (
        "Critical", "High", "Medium", "Low", "Informational"
    )}
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            """
            SELECT f.severity, COUNT(*)
            FROM findings AS f
            WHERE f.review_status != 'rejected'
            GROUP BY f.severity
            """
        ).fetchall()
    for severity, count in rows:
        if severity in values:
            values[severity] = count
    return [{"name": severity, "count": count} for severity, count in values.items()]


@app.get("/api/analytics/status")
def get_analytics_status():
    initialize_database()
    values = {
        "Open": 0,
        "In Progress": 0,
        "Resolved": 0,
        "Accepted Risk": 0,
    }
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            """
            SELECT status, COUNT(*)
            FROM findings
            WHERE review_status != 'rejected'
            GROUP BY status
            """
        ).fetchall()
    for status, count in rows:
        normalized_status = "Accepted Risk" if status == "Risk Accepted" else status
        if normalized_status in values:
            values[normalized_status] = count
    return [{"name": status, "count": count} for status, count in values.items()]


@app.get("/api/analytics/risk-distribution")
def get_analytics_risk_distribution():
    initialize_database()
    classifications = ("Critical", "High", "Medium", "Low")
    values = dict.fromkeys(classifications, 0)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            """
            SELECT r.classification, COUNT(*)
            FROM risk_scores AS r
            JOIN findings AS f ON f.id = r.finding_id
            WHERE f.review_status != 'rejected'
            GROUP BY r.classification
            """
        ).fetchall()
    for classification, count in rows:
        if classification in values:
            values[classification] = count
    return [
        {"name": f"{classification} Risk", "count": count}
        for classification, count in values.items()
    ]


def _analytics_category(category):
    normalized = (category or "").casefold()
    if any(term in normalized for term in ("access control", "authorization", "authentication", "identity")):
        return "Access Control"
    if any(term in normalized for term in ("network", "firewall", "port", "segmentation", "dns")):
        return "Network Security"
    if any(term in normalized for term in ("patch", "vulnerability", "cve", "outdated software")):
        return "Vulnerability Management"
    if any(term in normalized for term in ("data protection", "encryption", "privacy", "data leak")):
        return "Data Protection"
    if any(term in normalized for term in ("cloud", "aws", "azure", "gcp", "container")):
        return "Cloud Security"
    if any(term in normalized for term in ("incident response", "logging", "monitoring", "alerting")):
        return "Incident Response"
    return "Other"


@app.get("/api/analytics/categories")
def get_analytics_categories():
    initialize_database()
    categories = (
        "Access Control",
        "Network Security",
        "Vulnerability Management",
        "Data Protection",
        "Cloud Security",
        "Incident Response",
        "Other",
    )
    counts = dict.fromkeys(categories, 0)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            """
            SELECT f.category, COUNT(*)
            FROM findings AS f
            WHERE f.review_status != 'rejected'
            GROUP BY f.category
            """
        ).fetchall()
    for category, count in rows:
        counts[_analytics_category(category)] += count
    return [{"name": name, "count": count} for name, count in counts.items()]


@app.get("/api/analytics/top-priorities")
def get_analytics_top_priorities(limit: int = Query(default=10, ge=1, le=50)):
    initialize_database()
    items = _risk_records(limit=limit)
    if not items:
        return []
    ids = [item["id"] for item in items]
    placeholders = ",".join("?" for _ in ids)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        evidence_ids = {
            row[0]
            for row in connection.execute(
                f"""
                SELECT DISTINCT finding_id FROM finding_evidence
                WHERE finding_id IN ({placeholders})
                """,
                ids,
            ).fetchall()
        }
    return [
        {
            "id": item["id"],
            "title": item["title"],
            "severity": item["severity"],
            "risk_score": item["risk_score"],
            "risk_classification": item["risk_classification"],
            "status": item["status"],
            "affected_asset": item["affected_asset"],
            "document_id": item["document_id"],
            "original_filename": item["original_filename"],
            "evidence_available": item["id"] in evidence_ids,
        }
        for item in items
    ]


@app.get("/api/findings/{finding_id}/evidence")
def get_finding_evidence(finding_id: str):
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        exists = connection.execute(
            "SELECT 1 FROM findings WHERE id = ?",
            (finding_id,),
        ).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Finding not found.")
        rows = connection.execute(
            """
            SELECT e.id AS evidence_id, e.finding_id,
                   e.source_document_id, d.original_filename AS source_document_filename,
                   e.page_number, e.source_reference, e.evidence_excerpt,
                   e.chunk_id, e.start_offset, e.end_offset, e.created_at
            FROM finding_evidence AS e
            JOIN documents AS d ON d.id = e.source_document_id
            WHERE e.finding_id = ?
            ORDER BY e.created_at, e.id
            """,
            (finding_id,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/documents/{document_id}/source")
def get_document_source(document_id: str):
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        document = connection.execute(
            """
            SELECT id, original_filename, server_filename, extension, mime_type, size_bytes
            FROM documents WHERE id = ?
            """,
            (document_id,),
        ).fetchone()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        source_path = _stored_document_path(document["server_filename"])
    except ExtractionError as error:
        logger.exception("Stored source metadata is invalid for document %s", document_id)
        raise HTTPException(status_code=500, detail="Stored source document metadata is invalid.") from error
    if not source_path.is_file() or source_path.stat().st_size != document["size_bytes"]:
        raise HTTPException(status_code=404, detail="The original source document is unavailable.")
    return FileResponse(
        source_path,
        media_type=document["mime_type"],
        filename=document["original_filename"],
        content_disposition_type=(
            "attachment" if document["extension"] == ".docx" else "inline"
        ),
        headers={"X-Content-Type-Options": "nosniff"},
    )


def _risk_source_findings(include_rejected=False):
    status_filter = "" if include_rejected else "WHERE f.review_status != 'rejected'"
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"""
            SELECT f.*, d.original_filename AS document_filename
            FROM findings AS f
            JOIN documents AS d ON d.id = f.document_id
            {status_filter}
            ORDER BY f.created_at, f.id
            """
        ).fetchall()
    return [_row_to_finding(row) for row in rows]


def _risk_manual_overrides(finding_ids):
    if not finding_ids:
        return {}
    placeholders = ",".join("?" for _ in finding_ids)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            f"SELECT finding_id, overrides_json FROM risk_factor_overrides WHERE finding_id IN ({placeholders})",
            tuple(finding_ids),
        ).fetchall()
    return {row[0]: json.loads(row[1]) for row in rows}


def _risk_payload(finding, result, overrides):
    return {
        **finding,
        "risk_score": result["score"],
        "risk_classification": result["classification"],
        "score_completeness": result["score_completeness"],
        "is_provisional": result["is_provisional"],
        "missing_factors": result["missing_factors"],
        "factor_breakdown": result["factor_breakdown"],
        "weights": result["weights"],
        "formula": result["formula"],
        "engine_version": result["engine_version"],
        "calculated_at": result["calculated_at"],
        "calculation_trigger": result.get("calculation_trigger"),
        "manual_factor_overrides": overrides,
    }


def _calculate_risk_batch(findings, trigger, finding_ids=None):
    if not findings:
        return []
    weights = configured_weights()
    selected_ids = set(finding_ids) if finding_ids is not None else None
    overrides_by_id = _risk_manual_overrides([finding["id"] for finding in findings])
    calculated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    results = []
    for finding in findings:
        if selected_ids is not None and finding["id"] not in selected_ids:
            continue
        result = score_finding(
            finding,
            recurrence_report_count(finding, findings),
            manual_overrides=overrides_by_id.get(finding["id"], {}),
            weights=weights,
            calculated_at=calculated_at,
        )
        result["calculation_trigger"] = trigger
        results.append((finding, result, overrides_by_id.get(finding["id"], {})))

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            for finding, result, _ in results:
                breakdown_json = json.dumps(result["factor_breakdown"])
                weights_json = json.dumps(result["weights"], sort_keys=True)
                connection.execute(
                    """
                    INSERT INTO risk_scores (
                        finding_id, score, classification, score_completeness,
                        is_provisional, factor_breakdown_json, weights_json,
                        engine_version, calculation_trigger, calculated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(finding_id) DO UPDATE SET
                        score = excluded.score,
                        classification = excluded.classification,
                        score_completeness = excluded.score_completeness,
                        is_provisional = excluded.is_provisional,
                        factor_breakdown_json = excluded.factor_breakdown_json,
                        weights_json = excluded.weights_json,
                        engine_version = excluded.engine_version,
                        calculation_trigger = excluded.calculation_trigger,
                        calculated_at = excluded.calculated_at
                    """,
                    (
                        finding["id"],
                        result["score"],
                        result["classification"],
                        result["score_completeness"],
                        int(result["is_provisional"]),
                        breakdown_json,
                        weights_json,
                        result["engine_version"],
                        trigger,
                        calculated_at,
                    ),
                )
                connection.execute(
                    """
                    INSERT INTO risk_score_history (
                        finding_id, score, classification, score_completeness,
                        is_provisional, factor_breakdown_json, weights_json,
                        engine_version, calculation_trigger, calculated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        finding["id"],
                        result["score"],
                        result["classification"],
                        result["score_completeness"],
                        int(result["is_provisional"]),
                        breakdown_json,
                        weights_json,
                        result["engine_version"],
                        trigger,
                        calculated_at,
                    ),
                )
    return [
        _risk_payload(finding, result, overrides)
        for finding, result, overrides in results
    ]


def _calculate_single_risk(finding_id, trigger):
    findings = _risk_source_findings(include_rejected=True)
    finding = next((item for item in findings if item["id"] == finding_id), None)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found.")
    if finding["review_status"] == "rejected":
        raise HTTPException(status_code=409, detail="Rejected findings are excluded from risk scoring.")
    try:
        results = _calculate_risk_batch(
            [item for item in findings if item["review_status"] != "rejected"],
            trigger,
            finding_ids={finding_id},
        )
    except RiskEngineError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    if not results:
        raise HTTPException(status_code=500, detail="Risk score calculation returned no result.")
    return results[0]


def _risk_records(where_clause="", parameters=(), limit=200):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"""
            SELECT f.*, d.original_filename AS document_filename,
                   r.score AS risk_score, r.classification AS risk_classification,
                   r.score_completeness, r.is_provisional,
                   r.factor_breakdown_json, r.weights_json,
                   r.engine_version, r.calculation_trigger, r.calculated_at
            FROM risk_scores AS r
            JOIN findings AS f ON f.id = r.finding_id
            JOIN documents AS d ON d.id = f.document_id
            WHERE f.review_status != 'rejected' {where_clause}
            ORDER BY r.score DESC, r.score_completeness DESC, f.created_at ASC, f.id ASC
            LIMIT ?
            """,
            (*parameters, limit),
        ).fetchall()
    records = []
    for row in rows:
        record = dict(row)
        record["factor_breakdown"] = json.loads(record.pop("factor_breakdown_json"))
        record["weights"] = json.loads(record.pop("weights_json"))
        record["is_provisional"] = bool(record["is_provisional"])
        record["missing_factors"] = [
            name for name, factor in record["factor_breakdown"].items()
            if factor["value"] is None
        ]
        record["score_completeness"] = float(record["score_completeness"])
        record["risk_score"] = float(record["risk_score"])
        record["original_filename"] = record.pop("document_filename")
        for column, key in (
            ("cve_ids_json", "cve_ids"),
            ("cwe_ids_json", "cwe_ids"),
            ("compliance_references_json", "compliance_references"),
            ("uncertainty_notes_json", "uncertainty_notes"),
            ("field_provenance_json", "field_provenance"),
        ):
            record[key] = json.loads(record.pop(column))
        records.append(record)
    overrides = _risk_manual_overrides([record["id"] for record in records])
    for record in records:
        record["manual_factor_overrides"] = overrides.get(record["id"], {})
    return records


@app.post("/api/risk/calculate/{finding_id}")
def calculate_finding_risk(finding_id: str):
    initialize_database()
    return _calculate_single_risk(finding_id, "manual_calculation")


@app.post("/api/risk/calculate-all")
def calculate_all_risks():
    initialize_database()
    findings = _risk_source_findings()
    try:
        results = _calculate_risk_batch(findings, "bulk_calculation")
    except RiskEngineError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    return {
        "calculated_count": len(results),
        "provisional_count": sum(item["is_provisional"] for item in results),
        "complete_count": sum(not item["is_provisional"] for item in results),
        "findings": results,
    }


@app.get("/api/risk/overview")
def get_risk_overview():
    initialize_database()
    findings = _risk_source_findings()
    severity_counts = {severity.value: 0 for severity in Severity}
    for finding in findings:
        severity_counts[finding["severity"]] = severity_counts.get(finding["severity"], 0) + 1
    classification_counts = {name: 0 for name in RISK_THRESHOLDS}
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            """
            SELECT r.classification, COUNT(*) AS count
            FROM risk_scores AS r
            JOIN findings AS f ON f.id = r.finding_id
            WHERE f.review_status != 'rejected'
            GROUP BY r.classification
            """
        ).fetchall()
        totals = connection.execute(
            """
            SELECT COUNT(*) AS scored_count,
                   AVG(r.score) AS average_score,
                   SUM(r.is_provisional) AS provisional_count
            FROM risk_scores AS r
            JOIN findings AS f ON f.id = r.finding_id
            WHERE f.review_status != 'rejected'
            """
        ).fetchone()
    for classification, count in rows:
        if classification in classification_counts:
            classification_counts[classification] = count
    scored_count = totals[0] or 0
    provisional_count = totals[2] or 0
    return {
        "finding_count": len(findings),
        "scored_count": scored_count,
        "unscored_count": max(0, len(findings) - scored_count),
        "severity_counts": severity_counts,
        "risk_classification_counts": classification_counts,
        "average_contextual_risk": (
            round(totals[1], 2) if totals[1] is not None else None
        ),
        "provisional_count": provisional_count,
        "complete_count": max(0, scored_count - provisional_count),
        "weights": configured_weights(),
        "thresholds": RISK_THRESHOLDS,
        "cvss_is_separate": True,
    }


@app.get("/api/risk/findings")
def list_risk_findings(
    severity: str | None = None,
    category: str | None = None,
    document_id: str | None = None,
    risk_classification: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
):
    initialize_database()
    filters = []
    parameters = []
    if severity:
        filters.append("AND f.severity = ?")
        parameters.append(severity)
    if category:
        filters.append("AND LOWER(COALESCE(f.category, '')) = LOWER(?)")
        parameters.append(category)
    if document_id:
        filters.append("AND f.document_id = ?")
        parameters.append(document_id)
    if risk_classification:
        if risk_classification not in RISK_THRESHOLDS:
            raise HTTPException(status_code=422, detail="Unknown risk classification.")
        filters.append("AND r.classification = ?")
        parameters.append(risk_classification)
    return _risk_records(" ".join(filters), parameters, limit)


@app.get("/api/risk/findings/{finding_id}")
def get_risk_finding(finding_id: str):
    initialize_database()
    record = _risk_records("AND f.id = ?", (finding_id,), limit=1)
    if record:
        return record[0]
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        exists = connection.execute(
            "SELECT 1 FROM findings WHERE id = ?",
            (finding_id,),
        ).fetchone()
    if exists is None:
        raise HTTPException(status_code=404, detail="Finding not found.")
    raise HTTPException(status_code=409, detail="Risk score has not been calculated for this finding.")


@app.get("/api/risk/top-priorities")
def get_top_risk_priorities(limit: int = Query(default=10, ge=1, le=50)):
    initialize_database()
    return _risk_records(limit=limit)


@app.get("/api/risk/history/{finding_id}")
def get_risk_history(finding_id: str):
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        exists = connection.execute(
            "SELECT 1 FROM findings WHERE id = ?",
            (finding_id,),
        ).fetchone()
        if exists is None:
            raise HTTPException(status_code=404, detail="Finding not found.")
        rows = connection.execute(
            """
            SELECT score, classification, score_completeness, is_provisional,
                   factor_breakdown_json, weights_json, engine_version,
                   calculation_trigger, calculated_at
            FROM risk_score_history
            WHERE finding_id = ?
            ORDER BY calculated_at DESC, id DESC
            """,
            (finding_id,),
        ).fetchall()
    return [
        {
            **dict(row),
            "is_provisional": bool(row["is_provisional"]),
            "factor_breakdown": json.loads(row["factor_breakdown_json"]),
            "weights": json.loads(row["weights_json"]),
        }
        for row in rows
    ]


@app.patch("/api/risk/findings/{finding_id}/factors")
def update_risk_factors(finding_id: str, patch: RiskFactorPatch):
    initialize_database()
    try:
        configured_weights()
    except RiskEngineError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    findings = _risk_source_findings(include_rejected=True)
    finding = next((item for item in findings if item["id"] == finding_id), None)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found.")
    if finding["review_status"] == "rejected":
        raise HTTPException(status_code=409, detail="Rejected findings are excluded from risk scoring.")

    overrides_by_id = _risk_manual_overrides([finding_id])
    overrides = overrides_by_id.get(finding_id, {})
    updates = patch.model_dump(exclude_unset=True)
    rationale = updates.get("rationale")
    for factor in set(updates) & set(OVERRIDABLE_FACTORS):
        value = updates[factor]
        if value is None:
            overrides.pop(factor, None)
        else:
            overrides[factor] = {
                "value": value,
                "source": "manual",
                "rationale": rationale,
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            if overrides:
                connection.execute(
                    """
                    INSERT INTO risk_factor_overrides (finding_id, overrides_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(finding_id) DO UPDATE SET
                        overrides_json = excluded.overrides_json,
                        updated_at = excluded.updated_at
                    """,
                    (
                        finding_id,
                        json.dumps(overrides),
                        datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    ),
                )
            else:
                connection.execute(
                    "DELETE FROM risk_factor_overrides WHERE finding_id = ?",
                    (finding_id,),
                )
    return _calculate_single_risk(finding_id, "manual_factor_review")


@app.patch("/api/findings/{finding_id}")
def review_finding(finding_id: str, patch: FindingReviewPatch):
    initialize_database()
    updates = patch.model_dump(exclude_unset=True, mode="json")
    if not updates:
        raise HTTPException(status_code=400, detail="At least one review field is required.")
    if "title" in updates and not updates["title"]:
        raise HTTPException(status_code=422, detail="Finding title cannot be empty.")
    if "title" in updates and not updates["title"].strip():
        raise HTTPException(status_code=422, detail="Finding title cannot be empty.")
    if "severity" in updates and updates["severity"] is None:
        raise HTTPException(status_code=422, detail="Finding severity cannot be empty.")
    if "review_status" in updates and updates["review_status"] is None:
        raise HTTPException(status_code=422, detail="Review status cannot be empty.")
    if "status" in updates and updates["status"] is None:
        raise HTTPException(status_code=422, detail="Remediation status cannot be empty.")
    risk_relevant_fields = {
        "title",
        "category",
        "severity",
        "affected_asset",
        "business_impact",
        "exploitation_evidence",
        "review_status",
    }
    if risk_relevant_fields.intersection(updates):
        try:
            configured_weights()
        except RiskEngineError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            "SELECT field_provenance_json FROM findings WHERE id = ?",
            (finding_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Finding not found.")

        provenance = json.loads(row["field_provenance_json"])
        editable_columns = {
            "title", "description", "category", "severity", "affected_asset",
            "business_impact", "technical_impact", "exploitation_evidence",
            "remediation", "cvss_score", "cvss_vector", "review_status", "status",
            "reviewer_notes",
        }
        json_columns = {
            "cve_ids": "cve_ids_json",
            "cwe_ids": "cwe_ids_json",
            "compliance_references": "compliance_references_json",
        }
        assignments = []
        values = []
        for field, value in updates.items():
            if field in json_columns:
                assignments.append(f"{json_columns[field]} = ?")
                values.append(json.dumps(value or []))
                provenance[field] = "human_reviewed"
            elif field in editable_columns:
                assignments.append(f"{field} = ?")
                values.append(value.strip() if field == "title" else value)
                if field not in {"review_status", "status", "reviewer_notes"}:
                    provenance[field] = "human_reviewed"
        assignments.extend(["field_provenance_json = ?", "updated_at = ?"])
        values.extend(
            [json.dumps(provenance), datetime.now(timezone.utc).isoformat(timespec="seconds"), finding_id]
        )
        with connection:
            connection.execute(
                f"UPDATE findings SET {', '.join(assignments)} WHERE id = ?",
                values,
            )

    if risk_relevant_fields.intersection(updates):
        try:
            _calculate_risk_batch(_risk_source_findings(), "finding_review_update")
        except RiskEngineError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error
    return get_finding(finding_id)


def _read_document_segments(document_id):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT page_number, source_reference, section_reference, extracted_text
            FROM document_extraction_segments
            WHERE document_id = ?
            ORDER BY sequence_index
            """,
            (document_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def _index_document(document_id, force=False):
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document["status"] != "extracted":
        raise HTTPException(
            status_code=409,
            detail="Extract document text successfully before indexing.",
        )

    segments = _read_document_segments(document_id)
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        row = connection.execute(
            "SELECT rag_content_hash FROM documents WHERE id = ?",
            (document_id,),
        ).fetchone()
    existing_content_hash = row[0] if row is not None else None
    try:
        model_name, chunk_size, chunk_overlap = index_configuration()
        content_hash = document_fingerprint(
            segments,
            model_name,
            chunk_size,
            chunk_overlap,
        )
    except RagError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    if (
        document["rag_status"] == "indexed"
        and existing_content_hash == content_hash
        and not force
    ):
        try:
            chunk_count = _get_indexed_chunk_count(document_id)
        except RagError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        return {
            "document_id": document_id,
            "filename": document["original_filename"],
            "status": "indexed",
            "chunk_count": chunk_count,
            "already_indexed": True,
            "content_hash": content_hash,
        }

    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            cursor = connection.execute(
                """
                UPDATE documents
                SET rag_status = 'indexing', rag_error = NULL
                WHERE id = ? AND rag_status != 'indexing'
                """,
                (document_id,),
            )
            claimed = cursor.rowcount == 1
    if not claimed:
        raise HTTPException(status_code=409, detail="Document indexing is already in progress.")

    try:
        result = index_document_data(
            document_id,
            document["original_filename"],
            segments,
            force=force,
        )
        indexed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                connection.execute(
                    """
                    UPDATE documents
                    SET rag_status = 'indexed', rag_error = NULL, rag_indexed_at = ?,
                        rag_content_hash = ?, rag_model = ?
                    WHERE id = ?
                    """,
                    (indexed_at, result["content_hash"], result["model_name"], document_id),
                )
        return {
            **result,
            "indexed_at": indexed_at,
            "already_indexed": False,
        }
    except RagError as error:
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                connection.execute(
                    "UPDATE documents SET rag_status = 'failed', rag_error = ? WHERE id = ?",
                    (str(error), document_id),
                )
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                connection.execute(
                    "UPDATE documents SET rag_status = 'failed', rag_error = ? WHERE id = ?",
                    ("Indexing failed unexpectedly. Check the API logs.", document_id),
                )
        logger.exception("Unable to index document %s", document_id)
        raise HTTPException(
            status_code=502,
            detail="Indexing failed unexpectedly. Check the API logs.",
        ) from error


def _get_indexed_chunk_count(document_id):
    from backend.rag import _get_collection

    result = _get_collection().get(
        where={"document_id": document_id},
        include=[],
    )
    return len(result.get("ids", []))


@app.post("/api/rag/index/{document_id}")
def index_document(document_id: str, force: bool = False):
    initialize_database()
    return _index_document(document_id, force)


@app.post("/api/rag/index-all")
def index_all_documents(force: bool = False):
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        rows = connection.execute(
            "SELECT id FROM documents WHERE status = 'extracted' ORDER BY uploaded_at, id"
        ).fetchall()

    results = []
    for (document_id,) in rows:
        try:
            results.append(_index_document(document_id, force))
        except HTTPException as error:
            results.append(
                {
                    "document_id": document_id,
                    "status": "failed",
                    "error": error.detail,
                }
            )
    return {
        "indexed_count": sum(result["status"] == "indexed" for result in results),
        "failed_count": sum(result["status"] == "failed" for result in results),
        "documents": results,
    }


@app.get("/api/rag/index-status/{document_id}")
def get_rag_index_status(document_id: str):
    initialize_database()
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        chunk_count = (
            _get_indexed_chunk_count(document_id)
            if document["rag_status"] == "indexed"
            else 0
        )
    except RagError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {
        "document_id": document_id,
        "filename": document["original_filename"],
        "status": document["rag_status"],
        "error": document["rag_error"],
        "indexed_at": document["rag_indexed_at"],
        "model_name": document["rag_model"],
        "chunk_count": chunk_count,
    }


def _get_chat_history(conversation_id, limit=100):
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        connection.row_factory = sqlite3.Row
        conversation = connection.execute(
            "SELECT id FROM chat_conversations WHERE id = ?",
            (conversation_id,),
        ).fetchone()
        if conversation is None:
            return None
        rows = connection.execute(
            """
            SELECT id, role, content, citations_json, created_at
            FROM chat_messages
            WHERE conversation_id = ?
            ORDER BY id DESC LIMIT ?
            """,
            (conversation_id, limit),
        ).fetchall()
    messages = []
    for row in reversed(rows):
        message = dict(row)
        message["citations"] = json.loads(message.pop("citations_json"))
        messages.append(message)
    return messages


def _save_chat_message(conversation_id, role, content, citations=None):
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO chat_conversations (id, created_at, updated_at)
                VALUES (?, ?, ?)
                """,
                (conversation_id, created_at, created_at),
            )
            connection.execute(
                """
                INSERT INTO chat_messages (
                    conversation_id, role, content, citations_json, created_at
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    conversation_id,
                    role,
                    content,
                    json.dumps(citations or [], ensure_ascii=False),
                    created_at,
                ),
            )
            connection.execute(
                "UPDATE chat_conversations SET updated_at = ? WHERE id = ?",
                (created_at, conversation_id),
            )
    return created_at


@app.post("/api/chat/ask")
def ask_chat_question(request: ChatAskRequest):
    initialize_database()
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question cannot be empty.")
    conversation_id = request.conversation_id or str(uuid4())
    history = _get_chat_history(conversation_id) or []

    if request.document_ids:
        placeholders = ",".join("?" for _ in request.document_ids)
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            rows = connection.execute(
                f"""
                SELECT id, original_filename, status, rag_status
                FROM documents WHERE id IN ({placeholders})
                """,
                request.document_ids,
            ).fetchall()
        documents_by_id = {row[0]: row for row in rows}
        missing_ids = [item for item in request.document_ids if item not in documents_by_id]
        if missing_ids:
            raise HTTPException(status_code=404, detail="One or more selected documents were not found.")
        not_indexed = [
            row[1] for row in documents_by_id.values()
            if row[2] != "extracted" or row[3] != "indexed"
        ]
        if not_indexed:
            raise HTTPException(
                status_code=409,
                detail="Index selected documents before asking questions: "
                + ", ".join(not_indexed),
            )

    previous_questions = [
        message["content"]
        for message in history
        if message["role"] == "user"
    ][-3:]
    retrieval_question = question
    if previous_questions:
        retrieval_question = (
            "Previous questions in this conversation: "
            + " | ".join(previous_questions)
            + "\nCurrent question: "
            + question
        )

    try:
        retrieved = retrieve_chunks(
            retrieval_question,
            document_ids=request.document_ids,
            top_k=request.top_k,
        )
        _save_chat_message(conversation_id, "user", question)
        result = answer_question(question, history, retrieved)
    except RagError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except Exception as error:
        logger.exception("RAG chat request failed")
        raise HTTPException(
            status_code=502,
            detail="Unable to answer using indexed audit evidence. Check API logs.",
        ) from error

    response_time = _save_chat_message(
        conversation_id,
        "assistant",
        result["answer"],
        result["citations"],
    )
    return {
        "conversation_id": conversation_id,
        "answer": result["answer"],
        "insufficient_evidence": result["insufficient_evidence"],
        "citations": result["citations"],
        "created_at": response_time,
    }


@app.get("/api/chat/history/{conversation_id}")
def get_chat_history(conversation_id: str):
    initialize_database()
    messages = _get_chat_history(conversation_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {"conversation_id": conversation_id, "messages": messages}


@app.delete("/api/chat/history/{conversation_id}")
def delete_chat_history(conversation_id: str):
    initialize_database()
    with closing(sqlite3.connect(DATABASE_PATH)) as connection:
        with connection:
            exists = connection.execute(
                "SELECT 1 FROM chat_conversations WHERE id = ?",
                (conversation_id,),
            ).fetchone()
            if exists is None:
                raise HTTPException(status_code=404, detail="Conversation not found.")
            connection.execute(
                "DELETE FROM chat_messages WHERE conversation_id = ?",
                (conversation_id,),
            )
            cursor = connection.execute(
                "DELETE FROM chat_conversations WHERE id = ?",
                (conversation_id,),
            )
    return {"conversation_id": conversation_id, "deleted": True}


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: str):
    initialize_database()
    document = get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    try:
        delete_document_vectors(document_id)
        stored_path = _stored_document_path(
            _get_document_for_extraction(document_id)["server_filename"]
        )
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                connection.execute(
                    """
                    DELETE FROM risk_score_history
                    WHERE finding_id IN (SELECT id FROM findings WHERE document_id = ?)
                    """,
                    (document_id,),
                )
                connection.execute(
                    """
                    DELETE FROM risk_scores
                    WHERE finding_id IN (SELECT id FROM findings WHERE document_id = ?)
                    """,
                    (document_id,),
                )
                connection.execute(
                    """
                    DELETE FROM risk_factor_overrides
                    WHERE finding_id IN (SELECT id FROM findings WHERE document_id = ?)
                    """,
                    (document_id,),
                )
                connection.execute(
                    "DELETE FROM finding_evidence WHERE source_document_id = ?",
                    (document_id,),
                )
                connection.execute(
                    "DELETE FROM findings WHERE document_id = ?",
                    (document_id,),
                )
                connection.execute(
                    "DELETE FROM document_extraction_segments WHERE document_id = ?",
                    (document_id,),
                )
                connection.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        if stored_path.exists():
            stored_path.unlink()
    except (OSError, sqlite3.Error, RagError, ExtractionError) as error:
        logger.exception("Unable to completely delete document %s", document_id)
        raise HTTPException(
            status_code=500,
            detail="Unable to delete the document and its indexed data.",
        ) from error
    return {"document_id": document_id, "deleted": True}


DIST_DIR = Path(__file__).resolve().parent.parent / "dist"

if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API route not found.")
    file_path = DIST_DIR / full_path
    if full_path and file_path.is_file():
        return FileResponse(file_path)
    index_file = DIST_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(index_file)
    return {"message": "ThreatLens API is running. Build the frontend with 'npm run build' to serve the UI."}

