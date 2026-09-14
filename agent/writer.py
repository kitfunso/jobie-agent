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
    cover_letter: str = Field(description="Plain-text cover letter, 180 to 300 words")
    changes: list[str] = Field(description="What changed in the CV and why, one line each")
    gaps: list[str] = Field(description="Posting requirements the CV does not evidence")


@dataclass(frozen=True)
class Round:
    round: int
    findings: tuple[Finding, ...]


@dataclass(frozen=True)
class TailorOutcome:
    result: TailorResult
    rounds: tuple[Round, ...]


Generator = Callable[[str], TailorResult]


@tool
def slop_check(text: str, kind: str = "letter") -> dict:
    """Scan a draft for named AI-writing patterns. Zero findings means it passes.

    Args:
        text: The draft to scan.
        kind: "letter" for a cover letter, "cv" for CV text.
    """
    findings = [asdict(f) for f in check(text, kind)]
    return {"status": "success", "content": [{"text": json.dumps({"count": len(findings), "findings": findings})}]}


def _all_findings(result: TailorResult) -> tuple[Finding, ...]:
    return check(result.cover_letter, "letter") + check(result.cv_markdown, "cv")


def _findings_text(findings: tuple[Finding, ...]) -> str:
    return "\n".join(f"- {f.rule}: \"{f.quote}\" -> {f.fix}" for f in findings)


def run_loop(generate: Generator, prompt: str, max_rounds: int = 3) -> TailorOutcome:
    result = generate(prompt)
    rounds: list[Round] = []
    for n in range(1, max_rounds + 1):
        findings = _all_findings(result)
        rounds.append(Round(n, findings))
        if not findings or n == max_rounds:
            break
        result = generate(rewrite_prompt(_findings_text(findings)))
    return TailorOutcome(result, tuple(rounds))


def make_generator(model: Model) -> Generator:
    agent = Agent(model=model, tools=[slop_check], system_prompt=SYSTEM_PROMPT, callback_handler=None)

    def generate(prompt: str) -> TailorResult:
        out = agent(prompt, structured_output_model=TailorResult).structured_output
        if out is None:
            raise RuntimeError("model returned no structured output")
        return out

    return generate


def tailor(model: Model, title: str, company: str, location: str, description: str, cv_text: str) -> TailorOutcome:
    return run_loop(make_generator(model), first_prompt(title, company, location, description, cv_text))
