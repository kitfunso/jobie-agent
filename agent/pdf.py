"""Tiny markdown subset (#, ##, -, **bold**) to PDF. Enough for a CV and a letter."""
from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

BOLD = re.compile(r"\*\*(.+?)\*\*")


def _inline(text: str) -> str:
    return BOLD.sub(r"<b>\1</b>", escape(text))


def render_markdown_pdf(markdown: str, path: Path) -> Path:
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10.5, leading=14)
    flow: list = []
    bullets: list[str] = []

    def flush_bullets() -> None:
        if bullets:
            flow.append(ListFlowable([ListItem(Paragraph(_inline(b), body)) for b in bullets], bulletType="bullet", leftIndent=12))
            bullets.clear()

    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("- "):
            bullets.append(stripped[2:])
            continue
        flush_bullets()
        if stripped.startswith("# "):
            flow.append(Paragraph(_inline(stripped[2:]), styles["Title"]))
        elif stripped.startswith("## "):
            flow.append(Spacer(1, 4 * mm))
            flow.append(Paragraph(_inline(stripped[3:]), styles["Heading2"]))
        elif stripped:
            flow.append(Paragraph(_inline(stripped), body))
        else:
            flow.append(Spacer(1, 2 * mm))
    flush_bullets()
    path.parent.mkdir(parents=True, exist_ok=True)
    SimpleDocTemplate(str(path), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm).build(flow)
    return path
