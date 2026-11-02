import os
from pathlib import Path
import streamlit as st
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).resolve().parent / ".env")

from backend.extraction import extract_document, ExtractionError
from backend.analyzer import analyze_segments, AnalysisError
from backend.rag import index_document_data, answer_question, RagError

st.set_page_config(
    page_title="ThreatLens - Cyber Audit Intelligence",
    page_icon="🛡️",
    layout="wide",
)

st.title("🛡️ ThreatLens - Cybersecurity Audit Intelligence")
st.markdown("AI-assisted cybersecurity audit dashboard & decision support system.")

# Sidebar Configuration
with st.sidebar:
    st.header("⚙️ Configuration")
    gemini_key = st.text_input(
        "Gemini API Key",
        value=os.getenv("GEMINI_API_KEY", ""),
        type="password",
        help="Paste your Gemini API Key here or set GEMINI_API_KEY in environment.",
    )
    if gemini_key:
        os.environ["GEMINI_API_KEY"] = gemini_key

    st.markdown("---")
    st.subheader("Upload Audit Report")
    uploaded_file = st.file_uploader(
        "Choose a PDF, DOCX, or TXT file",
        type=["pdf", "docx", "txt"],
    )

if "extracted_segments" not in st.session_state:
    st.session_state.extracted_segments = None
if "analysis_results" not in st.session_state:
    st.session_state.analysis_results = None
if "indexed" not in st.session_state:
    st.session_state.indexed = False
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

tab_overview, tab_findings, tab_chat, tab_text = st.tabs([
    "📊 Overview & Status",
    "🛡️ Audit Findings",
    "🤖 AI Assistant (Q&A)",
    "📄 Extracted Text",
])

# Process Uploaded File
if uploaded_file is not None:
    file_bytes = uploaded_file.getvalue()
    extension = Path(uploaded_file.name).suffix

    if st.sidebar.button("🚀 Extract & Run AI Analysis", type="primary"):
        with st.spinner("Extracting text from report..."):
            try:
                segments, status, pages, err = extract_document(file_bytes, extension)
                st.session_state.extracted_segments = segments
                st.session_state.page_count = pages
                st.sidebar.success(f"Extracted {len(segments)} segments successfully!")
            except ExtractionError as e:
                st.sidebar.error(f"Extraction failed: {e}")
                st.stop()

        with st.spinner("Analyzing vulnerabilities with Gemini..."):
            try:
                analysis = analyze_segments(st.session_state.extracted_segments)
                st.session_state.analysis_results = analysis
                st.sidebar.success(f"Identified {len(analysis.get('findings', []))} findings!")
            except AnalysisError as e:
                st.sidebar.error(f"Analysis failed: {e}")

        with st.spinner("Indexing report evidence for Q&A..."):
            try:
                index_document_data(
                    document_id="doc_current",
                    filename=uploaded_file.name,
                    segments=st.session_state.extracted_segments,
                    force=True,
                )
                st.session_state.indexed = True
                st.sidebar.success("Document indexed for AI Assistant!")
            except Exception as e:
                st.sidebar.warning(f"Indexing warning: {e}")

# TAB 1: Overview
with tab_overview:
    if uploaded_file is None:
        st.info("👈 Upload an audit report (PDF, DOCX, or TXT) in the sidebar to begin.")
    else:
        st.subheader("Report Summary")
        col1, col2, col3 = st.columns(3)
        col1.metric("Filename", uploaded_file.name)
        col2.metric("Size", f"{len(file_bytes) / 1024:.1f} KB")
        col3.metric(
            "Extracted Segments",
            len(st.session_state.extracted_segments) if st.session_state.extracted_segments else "Pending",
        )

        if st.session_state.analysis_results:
            findings = st.session_state.analysis_results.get("findings", [])
            st.markdown("### Severity Distribution")
            severities = {}
            for f in findings:
                sev = f.get("severity", "Unknown")
                severities[sev] = severities.get(sev, 0) + 1
            st.bar_chart(severities)

# TAB 2: Findings
with tab_findings:
    if not st.session_state.analysis_results:
        st.info("No findings yet. Click 'Extract & Run AI Analysis' in the sidebar.")
    else:
        findings = st.session_state.analysis_results.get("findings", [])
        st.subheader(f"Identified Security Findings ({len(findings)})")
        for idx, f in enumerate(findings):
            sev = f.get("severity", "Medium")
            sev_color = {
                "Critical": "🔴",
                "High": "🟠",
                "Medium": "🟡",
                "Low": "🟢",
                "Informational": "🔵",
            }.get(sev, "⚪")

            with st.expander(f"{sev_color} **[{sev.upper()}]** {f.get('title', 'Untitled Finding')}"):
                st.markdown(f"**Description:** {f.get('description', 'N/A')}")
                st.markdown(f"**Category:** `{f.get('category', 'General')}`")
                st.markdown(f"**Affected Asset:** `{f.get('affected_asset', 'N/A')}`")
                st.markdown(f"**Remediation:** {f.get('remediation', 'N/A')}")
                if f.get("evidence_excerpt"):
                    st.info(f"**Evidence Excerpt:**\n> {f.get('evidence_excerpt')}")

# TAB 3: Q&A Assistant
with tab_chat:
    st.subheader("Chat with Your Audit Report")
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    user_query = st.chat_input("Ask a question about this audit report...")
    if user_query:
        st.session_state.chat_history.append({"role": "user", "content": user_query})
        with st.chat_message("user"):
            st.markdown(user_query)

        with st.chat_message("assistant"):
            with st.spinner("Finding grounded evidence..."):
                try:
                    result = answer_question(
                        question=user_query,
                        history=st.session_state.chat_history[:-1],
                        document_ids=["doc_current"] if st.session_state.indexed else None,
                    )
                    answer_text = result.get("answer", "No answer generated.")
                    st.markdown(answer_text)
                    if result.get("citations"):
                        with st.expander("📌 Source Citations"):
                            for cit in result["citations"]:
                                st.markdown(f"- **{cit.get('reference', 'Evidence')}**: *\"{cit.get('excerpt', '')}\"*")
                    st.session_state.chat_history.append({"role": "assistant", "content": answer_text})
                except Exception as e:
                    err_msg = f"Unable to answer: {e}"
                    st.error(err_msg)
                    st.session_state.chat_history.append({"role": "assistant", "content": err_msg})

# TAB 4: Extracted Text
with tab_text:
    if not st.session_state.extracted_segments:
        st.info("No extracted text to show.")
    else:
        st.subheader("Raw Extracted Segments")
        for idx, seg in enumerate(st.session_state.extracted_segments):
            st.text_area(
                f"Segment #{idx + 1} (Page {seg.get('page_number', 'N/A')})",
                seg.get("extracted_text", ""),
                height=150,
            )
