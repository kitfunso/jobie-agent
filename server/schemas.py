from pydantic import BaseModel


class Posting(BaseModel):
    title: str
    company: str
    location: str
    description: str
    url: str


class Provider(BaseModel):
    name: str
    api_key: str = ""
    model_id: str = ""
    region: str = ""


class TailorRequest(BaseModel):
    posting: Posting
    cv_text: str
    provider: Provider


class FindingOut(BaseModel):
    rule: str
    quote: str
    fix: str


class RoundOut(BaseModel):
    round: int
    source: str
    findings: list[FindingOut]


class TailorResponse(BaseModel):
    cv_markdown: str
    cover_letter: str
    changes: list[str]
    gaps: list[str]
    rounds: list[RoundOut]
    cv_pdf: str
    letter_pdf: str
