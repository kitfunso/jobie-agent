"""Deterministic scorer: returns named findings, never an AI-or-not guess."""
from __future__ import annotations

import statistics
from dataclasses import dataclass

from agent.slop_rules import (EM_DASH, MAX_LETTER_WORDS, RULES, SENTENCE_SPLIT, SUMMARY_OPENERS)


@dataclass(frozen=True)
class Finding:
    rule: str
    quote: str
    fix: str


def check(text: str, kind: str = "letter") -> tuple[Finding, ...]:
    findings: list[Finding] = []
    for rule in RULES:
        if kind not in rule.kinds:
            continue
        for match in rule.pattern.finditer(text):
            findings.append(Finding(rule.name, _sentence_around(text, match.start()), rule.fix))
    findings.extend(_shape_findings(text, kind))
    return tuple(findings)


def _sentence_around(text: str, pos: int) -> str:
    start = max(text.rfind(".", 0, pos), text.rfind("\n", 0, pos)) + 1
    end_candidates = [i for i in (text.find(".", pos), text.find("\n", pos)) if i != -1]
    end = min(end_candidates) + 1 if end_candidates else len(text)
    return text[start:end].strip()[:160]


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in SENTENCE_SPLIT.split(text) if s.strip()]


def _shape_findings(text: str, kind: str) -> list[Finding]:
    out: list[Finding] = []
    sentences = _sentences(text)
    dashes = len(EM_DASH.findall(text))
    if (kind == "letter" and dashes >= 1) or dashes >= 3:
        out.append(Finding("em dash", _sentence_around(text, EM_DASH.search(text).start()), "use a comma, full stop or brackets"))
    if kind != "letter":
        return out
    words = len(text.split())
    if words > MAX_LETTER_WORDS:
        out.append(Finding("too long", f"{words} words", f"cut to under {MAX_LETTER_WORDS} words"))
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    if paragraphs and SUMMARY_OPENERS.match(paragraphs[-1]):
        out.append(Finding("summary ending", paragraphs[-1][:160], "end on the last concrete point or next action"))
    if len(sentences) >= 5:
        i_openers = sum(1 for s in sentences if s.startswith("I "))
        if i_openers / len(sentences) >= 0.6:
            out.append(Finding("monotone openers", " ".join(sentences[:2])[:160], "start fewer sentences with I"))
    if len(sentences) >= 6:
        lengths = [len(s.split()) for s in sentences]
        if statistics.pstdev(lengths) < 3.0:
            out.append(Finding("robotic rhythm", " ".join(sentences[:2])[:160], "vary sentence length"))
    return out
