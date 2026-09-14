from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError


def extract_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
    except PdfReadError as exc:
        raise ValueError(f"not a readable PDF: {exc}") from exc
    text = "\n\n".join(p.strip() for p in pages if p.strip())
    if len(text) < 50:
        raise ValueError("no text layer found; export the CV as a text PDF, not a scan")
    return text
