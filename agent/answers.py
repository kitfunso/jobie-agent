"""Answers one page of application form fields from the profile, the notes and the CV, and never guesses."""
from __future__ import annotations

import json
from collections.abc import Callable, Sequence

from pydantic import BaseModel, Field
from strands import Agent
from strands.models import Model

ANSWER_PROMPT = """You fill in one page of a job application form for one applicant.

You get the form's fields as JSON: id, label, kind, whether it is required, the options where the field has a
fixed list, and the current value. You also get the applicant's profile, their notes and their CV.

For each field, answer only from the profile, the notes or the CV. If none of them gives the answer, set value to
null and say in reason, in a few words, what is missing. Never guess: not whether they worked for this employer
before, not how they heard of the job, not their right to work, not salary, not a notice period, unless the notes
say so. Leave a field that already holds a value alone: value null, reason "already set". A field that is not
required stays null unless the sources state its value: never tick a checkbox or pick an option to be helpful.
A field named for one thing takes only that thing: a GitHub or portfolio link is not a LinkedIn URL.

You may also get answers the applicant gave on earlier applications. When a field asks the same thing in other words,
reuse that answer and pick the option that matches it. When the question differs in substance, do not.

For kind "dropdown" or "radio", value must be one of the options, copied exactly. For kind "checkbox", value is
"Yes" or "No". For kind "prompt" (a search box), value is a short term to search for: a country name, a source such
as LinkedIn. For text answers, write as the applicant in plain words, one or two sentences at most, no praise for
the company, no filler, no em dashes. Return one answer per field, in the order given.
"""


class FormField(BaseModel):
    id: str
    label: str
    kind: str
    required: bool = False
    options: list[str] = Field(default_factory=list)
    value: str = ""


class Answer(BaseModel):
    id: str = Field(description="The field id, copied exactly")
    value: str | None = Field(description="The answer, or null when the profile, notes and CV do not give it")
    reason: str = Field(description="What the answer rests on, or what is missing")


class FormAnswers(BaseModel):
    answers: list[Answer]


class KnownAnswer(BaseModel):
    question: str
    answer: str


Answerer = Callable[[str], FormAnswers]


def answer_prompt(fields: list[FormField], profile: dict, cv_text: str, posting_title: str, company: str,
                  known: Sequence[KnownAnswer] = ()) -> str:
    notes = profile.get("notes", "")
    facts = {k: v for k, v in profile.items() if k != "notes" and v}
    earlier = "\n".join(f"- Q: {k.question}\n  A: {k.answer}" for k in known) or "(none)"
    return (
        f"FORM PAGE for {posting_title} at {company}\n{json.dumps([f.model_dump() for f in fields], indent=1)}\n\n"
        f"PROFILE\n{json.dumps(facts, indent=1)}\n\nNOTES\n{notes or '(none)'}\n\n"
        f"ANSWERS FROM EARLIER APPLICATIONS\n{earlier}\n\nCV\n{cv_text}\n\n"
        "Answer every field."
    )


def _normalise(field: FormField, value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    text = value.strip()
    if field.kind in ("dropdown", "radio"):
        return next((o for o in field.options if o.lower() == text.lower()), None)
    if field.kind == "checkbox":
        if text.lower() in ("yes", "true", "y"):
            return "Yes"
        return "No" if text.lower() in ("no", "false", "n") else None
    return text


def answer_fields(answerer: Answerer, fields: list[FormField], profile: dict, cv_text: str,
                  posting_title: str = "", company: str = "", known: Sequence[KnownAnswer] = ()) -> list[Answer]:
    """One answer per field, options enforced here so a model's paraphrase never reaches the form."""
    by_id = {f.id: f for f in fields}
    out = answerer(answer_prompt(fields, profile, cv_text, posting_title, company, known))
    seen: dict[str, Answer] = {}
    for a in out.answers:
        field = by_id.get(a.id)
        if field is None or a.id in seen:
            continue
        value = _normalise(field, a.value)
        reason = a.reason if value is not None or a.value is None else f'"{a.value}" is not one of the options'
        seen[a.id] = Answer(id=a.id, value=value, reason=reason)
    return [seen.get(f.id, Answer(id=f.id, value=None, reason="no answer from the model")) for f in fields]


def make_answerer(model: Model) -> Answerer:
    agent = Agent(model=model, system_prompt=ANSWER_PROMPT, callback_handler=None)

    def answer(prompt: str) -> FormAnswers:
        out = agent(prompt, structured_output_model=FormAnswers).structured_output
        if out is None:
            raise RuntimeError("model returned no structured output")
        return out

    return answer
