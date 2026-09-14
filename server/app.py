"""Local server for the jobie-agent extension. Binds to 127.0.0.1 only."""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import asdict
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from agent.cv import extract_text
from agent.pdf import render_markdown_pdf
from agent.providers import ProviderConfig, build_model
from agent.writer import tailor
from server.schemas import RoundOut, TailorRequest, TailorResponse

load_dotenv()
log = logging.getLogger("jobie")
VERSION = "0.1.0"
OUT_DIR = Path.home() / ".jobie" / "out"
SAFE_NAME = re.compile(r"^[A-Za-z0-9_-]+\.pdf$")

app = FastAPI(title="jobie-agent", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origin_regex=r"^(chrome-extension://.*|http://(localhost|127\.0\.0\.1)(:\d+)?)$",
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict:
    return {"ok": True, "version": VERSION}


@app.post("/cv/parse")
async def cv_parse(file: UploadFile) -> dict:
    try:
        return {"text": extract_text(await file.read())}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/tailor", response_model=TailorResponse)
def tailor_endpoint(req: TailorRequest) -> TailorResponse:
    try:
        model = build_model(ProviderConfig(**req.provider.model_dump()))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    p = req.posting
    outcome = tailor(model, p.title, p.company, p.location, p.description, req.cv_text)
    job_id = uuid.uuid4().hex[:8]
    cv_name, letter_name = f"{job_id}-cv.pdf", f"{job_id}-letter.pdf"
    render_markdown_pdf(outcome.result.cv_markdown, OUT_DIR / cv_name)
    render_markdown_pdf(outcome.result.cover_letter, OUT_DIR / letter_name)
    log.info("tailored %s at %s: rounds=%d final_findings=%d", p.title, p.company, len(outcome.rounds), len(outcome.rounds[-1].findings))
    return TailorResponse(
        **outcome.result.model_dump(),
        rounds=[RoundOut(round=r.round, findings=[asdict(f) for f in r.findings]) for r in outcome.rounds],
        cv_pdf=f"/files/{cv_name}", letter_pdf=f"/files/{letter_name}",
    )


@app.get("/files/{name}")
def files(name: str) -> FileResponse:
    if not SAFE_NAME.match(name) or not (OUT_DIR / name).exists():
        raise HTTPException(404, "no such file")
    return FileResponse(OUT_DIR / name, media_type="application/pdf", filename=name)
