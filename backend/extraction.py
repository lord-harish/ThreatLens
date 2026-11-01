import io
import re
import unicodedata
import zipfile
from pathlib import Path

import pymupdf as fitz
from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_PDF_PAGES = 500
MAX_DOCX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024
MAX_EXTRACTED_TEXT_CHARS = 10_000_000


class ExtractionError(Exception):
    def __init__(self, message, status="failed"):
        super().__init__(message)
        self.status = status


def normalize_text(text):
    normalized_lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(normalized_lines)).strip()


def _validate_size(data):
    if not data:
        raise ExtractionError("The uploaded document is empty.")
    if len(data) > MAX_FILE_SIZE:
        raise ExtractionError("The document exceeds the 20 MB extraction limit.")


def _extract_pdf(data):
    if not data.startswith(b"%PDF-"):
        raise ExtractionError("The file extension is PDF, but the file is not a valid PDF.")

    try:
        pdf = fitz.open(stream=data, filetype="pdf")
    except Exception as error:
        raise ExtractionError("The PDF is corrupted or cannot be opened.") from error

    with pdf:
        if pdf.is_encrypted:
            raise ExtractionError("The PDF is encrypted and cannot be extracted without a password.")
        if pdf.page_count == 0:
            raise ExtractionError("The PDF contains no pages.")
        if pdf.page_count > MAX_PDF_PAGES:
            raise ExtractionError(
                f"The PDF has more than the {MAX_PDF_PAGES}-page extraction limit."
            )

        segments = []
        extracted_chars = 0
        image_count = 0
        for page_number, page in enumerate(pdf, start=1):
            text = normalize_text(page.get_text("text", sort=True))
            extracted_chars += len(text)
            image_count += len(page.get_images(full=True))
            segments.append(
                {
                    "page_number": page_number,
                    "source_reference": f"page-{page_number}",
                    "section_reference": None,
                    "extracted_text": text,
                }
            )
            if extracted_chars > MAX_EXTRACTED_TEXT_CHARS:
                raise ExtractionError("The extracted text exceeds the 10 MB text limit.")

        if extracted_chars == 0:
            if image_count:
                return segments, "requires_ocr", (
                    "No selectable text was found. This PDF appears to be scanned and requires OCR."
                ), pdf.page_count
            raise ExtractionError("The PDF contains no extractable text or scanned page images.")
        return segments, "extracted", None, pdf.page_count


def _validate_docx(data):
    if not data.startswith(b"PK"):
        raise ExtractionError("The file extension is DOCX, but the file is not a valid DOCX archive.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            uncompressed_size = sum(info.file_size for info in archive.infolist())
            if uncompressed_size > MAX_DOCX_UNCOMPRESSED_SIZE:
                raise ExtractionError("The DOCX expands beyond the 50 MB extraction limit.")
            if archive.testzip() is not None:
                raise ExtractionError("The DOCX archive is corrupted.")
            required_parts = {"[Content_Types].xml", "word/document.xml"}
            if not required_parts.issubset(archive.namelist()):
                raise ExtractionError("The file is not a valid DOCX document.")
    except ExtractionError:
        raise
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as error:
        raise ExtractionError("The DOCX archive is corrupted or cannot be opened.") from error


def _iter_document_blocks(document):
    body = document.element.body
    for child in body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def _extract_docx(data):
    _validate_docx(data)
    try:
        document = Document(io.BytesIO(data))
    except Exception as error:
        raise ExtractionError("The DOCX document is corrupted or cannot be parsed.") from error

    segments = []
    section_reference = None
    extracted_chars = 0
    paragraph_number = 0
    table_number = 0

    for block in _iter_document_blocks(document):
        if isinstance(block, Paragraph):
            paragraph_number += 1
            text = normalize_text(block.text)
            if not text:
                continue
            style_name = block.style.name if block.style is not None else ""
            if style_name.lower().startswith("heading"):
                section_reference = text
            segments.append(
                {
                    "page_number": None,
                    "source_reference": f"paragraph-{paragraph_number}",
                    "section_reference": section_reference,
                    "extracted_text": text,
                }
            )
            extracted_chars += len(text)
        else:
            table_number += 1
            seen_cells = set()
            for row_number, row in enumerate(block.rows, start=1):
                for cell_number, cell in enumerate(row.cells, start=1):
                    cell_identity = id(cell._tc)
                    if cell_identity in seen_cells:
                        continue
                    seen_cells.add(cell_identity)
                    text = normalize_text("\n".join(p.text for p in cell.paragraphs))
                    if not text:
                        continue
                    segments.append(
                        {
                            "page_number": None,
                            "source_reference": (
                                f"table-{table_number}-row-{row_number}-cell-{cell_number}"
                            ),
                            "section_reference": section_reference,
                            "extracted_text": text,
                        }
                    )
                    extracted_chars += len(text)

        if extracted_chars > MAX_EXTRACTED_TEXT_CHARS:
            raise ExtractionError("The extracted text exceeds the 10 MB text limit.")

    if not segments:
        raise ExtractionError("The DOCX contains no extractable text.")
    return segments, "extracted", None, None


def _decode_txt(data):
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        encodings = ("utf-16",)
    else:
        encodings = ("utf-8-sig", "cp1252")

    text = None
    for encoding in encodings:
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ExtractionError("The TXT file encoding is unsupported or invalid.")

    if any(
        unicodedata.category(character) == "Cc" and character not in "\n\r\t\f"
        for character in text
    ):
        raise ExtractionError("The TXT file contains binary data, not readable text.")
    return text


def _extract_txt(data):
    decoded_text = _decode_txt(data)
    line_count = decoded_text.count("\n") + 1
    text = normalize_text(decoded_text)
    if not text:
        raise ExtractionError("The TXT file contains no extractable text.")
    if len(text) > MAX_EXTRACTED_TEXT_CHARS:
        raise ExtractionError("The extracted text exceeds the 10 MB text limit.")
    return (
        [
            {
                "page_number": None,
                "source_reference": f"lines-1-{line_count}",
                "section_reference": None,
                "extracted_text": text,
            }
        ],
        "extracted",
        None,
        None,
    )


def extract_document(data, extension):
    _validate_size(data)
    extractors = {
        ".pdf": _extract_pdf,
        ".docx": _extract_docx,
        ".txt": _extract_txt,
    }
    normalized_extension = extension.lower()
    if not normalized_extension.startswith("."):
        normalized_extension = Path(normalized_extension).suffix
    extractor = extractors.get(normalized_extension)
    if extractor is None:
        raise ExtractionError("Unsupported document format.")
    return extractor(data)
