"""Deterministic scorer: returns named findings, never an AI-or-not guess."""
from __future__ import annotations

import statistics
from dataclasses import dataclass

from agent.slop_rules import (CONTRACTIONS, CURRENCY, DIGITS, ECHO_NGRAM, EM_DASH, EXAMPLE_LETTER, MAX_LETTER_WORDS,
                              MAX_NUMBERS_PER_LETTER, MAX_NUMBERS_PER_SENTENCE, MIN_WORDS_FOR_CONTRACTIONS, NUMBER,
                              NUMBER_WORDS, RULES, SENTENCE_SPLIT, SUMMARY_OPENERS, WORD, YEAR)


@dataclass(frozen=True)
class Finding:
    rule: str
    quote: str
    fix: str


def check(text: str, kind: str = "letter", posting: str = "", cv: str = "") -> tuple[Finding, ...]:
    """Findings for a draft; the posting catches copied phrases, the CV catches numbers it never gave."""
    findings: list[Finding] = []
    for rule in RULES:
        if kind not in rule.kinds:
            continue
        for match in rule.pattern.finditer(text):
            findings.append(Finding(rule.name, _sentence_around(text, match.start()), rule.fix))
    findings.extend(_shape_findings(text, kind))
    if kind == "letter":
        findings.extend(_echo_findings(text, posting, "posting echo"))
        findings.extend(_echo_findings(text, EXAMPLE_LETTER, "example echo"))
        if cv:
            findings.extend(_unsourced_numbers(text, cv + "\n" + posting))
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
    for s in sentences:
        if len(NUMBER.findall(YEAR.sub("", s))) > MAX_NUMBERS_PER_SENTENCE:
            out.append(Finding("number pile", s[:160], "one number per sentence; move the rest or say them in words"))
    total = len(NUMBER.findall(YEAR.sub("", text)))
    if total > MAX_NUMBERS_PER_LETTER:
        out.append(Finding("stat sheet", f"{total} numbers", f"keep the {MAX_NUMBERS_PER_LETTER} that matter, cut the rest"))
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
    if words >= MIN_WORDS_FOR_CONTRACTIONS and not CONTRACTIONS.search(text.replace("’", "'")):
        out.append(Finding("no contractions", sentences[0][:160] if sentences else "",
                           "use two or three contractions where you would say them (I've, I'm, that's)"))
    return out


def _ngrams(text: str) -> set[tuple[str, ...]]:
    words = WORD.findall(text.lower())
    return {tuple(words[i:i + ECHO_NGRAM]) for i in range(len(words) - ECHO_NGRAM + 1)}


def _echo_findings(text: str, source: str, name: str) -> list[Finding]:
    """A run of ECHO_NGRAM words shared with the posting or the example is not the applicant talking."""
    source_grams = _ngrams(source) if source else set()
    if not source_grams:
        return []
    return [Finding(name, s[:160], "say it in the applicant's own words")
            for s in _sentences(text) if _ngrams(s) & source_grams]


def _number_tokens(text: str) -> set[str]:
    """Digits, small number words and currency signs, years dropped, so "600k" and "five" compare against the CV."""
    digits = {d.lstrip("0") or "0" for m in NUMBER.findall(YEAR.sub("", text)) for d in DIGITS.findall(m.replace(",", ""))}
    words = {NUMBER_WORDS[w] for w in WORD.findall(text.lower()) if w in NUMBER_WORDS}
    return digits | words | set(CURRENCY.findall(text))


def _unsourced_numbers(text: str, sources: str) -> list[Finding]:
    """A number or currency sign in the letter that is in neither the CV nor the posting was made up."""
    known = _number_tokens(sources)
    return [Finding("unsourced number", s[:160], "keep to the numbers and currency signs the CV gives, or drop the number")
            for s in _sentences(text) if _number_tokens(s) - known]
