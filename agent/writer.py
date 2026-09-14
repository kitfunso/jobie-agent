from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import asdict, dataclass

from pydantic import BaseModel, Field
from strands import Agent, tool
from strands.models import Model

from agent.prompts import SYSTEM_PROMPT, first_prompt, rewrite_prompt
from agent.slop import Finding, check


class TailorResult(BaseModel):
    cv_markdown: str = Field(description="The tailored CV in markdown")
    cover_letter: str = Field(description="Plain-text cover letter, 150 to 250 words")
    changes: list[str] = Field(description="What changed in the CV and why, one line each")
    gaps: list[str] = Field(description="Posting requirements the CV does not evidence")


@dataclass(frozen=True)
class Round:
    round: int
    source: str  # "agent": a slop_check the model ran mid-turn; "loop": the Python check after the turn
    findings: tuple[Finding, ...]


@dataclass(frozen=True)
class Generation:
    result: TailorResult
    self_checks: tuple[tuple[Finding, ...], ...]


@dataclass(frozen=True)
class TailorOutcome:
    result: TailorResult
    rounds: tuple[Round, ...]


Generator = Callable[[str], Generation]


@tool
def slop_check(text: str, kind: str = "letter") -> dict:
    """Scan a draft for named AI-writing patterns. Zero findings means it passes.

    Args:
        text: The draft to scan.
        kind: "letter" for a cover letter, "cv" for CV text.
    """
    findings = [asdict(f) for f in check(text, kind)]
    return {"status": "success", "content": [{"text": json.dumps({"count": len(findings), "findings": findings})}]}


def _all_findings(result: TailorResult, posting: str, cv: str) -> tuple[Finding, ...]:
    return check(result.cover_letter, "letter", posting, cv) + check(result.cv_markdown, "cv")


def _findings_text(findings: tuple[Finding, ...]) -> str:
    return "\n".join(f"- {f.rule}: \"{f.quote}\" -> {f.fix}" for f in findings)


def run_loop(generate: Generator, prompt: str, max_rounds: int = 2, posting: str = "", cv: str = "") -> TailorOutcome:
    gen = generate(prompt)
    rounds: list[Round] = []
    for n in range(1, max_rounds + 1):
        rounds.extend(Round(n, "agent", f) for f in gen.self_checks)
        findings = _all_findings(gen.result, posting, cv)
        rounds.append(Round(n, "loop", findings))
        if not findings or n == max_rounds:
            break
        gen = generate(rewrite_prompt(_findings_text(findings)))
    return TailorOutcome(gen.result, tuple(rounds))


def self_checks(messages: list[dict]) -> tuple[tuple[Finding, ...], ...]:
    """slop_check results the model asked for during a turn, in call order, paired to the toolUse by id."""
    blocks = [b for m in messages for b in m["content"]]
    ids = {b["toolUse"]["toolUseId"] for b in blocks if b.get("toolUse", {}).get("name") == "slop_check"}
    results = [b["toolResult"] for b in blocks if b.get("toolResult", {}).get("toolUseId") in ids]
    return tuple(_findings_from(r) for r in results)


def _findings_from(result: dict) -> tuple[Finding, ...]:
    text = "".join(c.get("text", "") for c in result["content"])
    return tuple(Finding(**f) for f in json.loads(text)["findings"])


def make_generator(model: Model) -> Generator:
    agent = Agent(model=model, tools=[slop_check], system_prompt=SYSTEM_PROMPT, callback_handler=None)

    def generate(prompt: str) -> Generation:
        start = len(agent.messages)
        out = agent(prompt, structured_output_model=TailorResult).structured_output
        if out is None:
            raise RuntimeError("model returned no structured output")
        return Generation(out, self_checks(agent.messages[start:]))

    return generate


def tailor(model: Model, title: str, company: str, location: str, description: str, cv_text: str) -> TailorOutcome:
    return run_loop(make_generator(model), first_prompt(title, company, location, description, cv_text),
                    posting=description, cv=cv_text)
