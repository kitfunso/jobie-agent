import pytest
from fastapi.testclient import TestClient
import server.app as app_module
from agent.writer import Round, TailorOutcome, TailorResult


def fake_tailor(model, title, company, location, description, cv_text):
    return TailorOutcome(
        TailorResult(cv_markdown="# Keith So\n\n- Python", cover_letter="Short and clean.", changes=["x"], gaps=[]),
        (Round(1, "loop", ()),),
    )


def test_health():
    client = TestClient(app_module.app)
    assert client.get("/health").json() == {"ok": True, "version": "0.1.0"}


def test_tailor_returns_files_and_rounds(monkeypatch, tmp_path):
    monkeypatch.setattr(app_module, "tailor", fake_tailor)
    monkeypatch.setattr(app_module, "build_model", lambda cfg: object())
    monkeypatch.setattr(app_module, "OUT_DIR", tmp_path)
    client = TestClient(app_module.app)
    body = {
        "posting": {"title": "Analyst", "company": "Acme", "location": "London", "description": "Python", "url": "https://x"},
        "cv_text": "Keith So. Python.",
        "provider": {"name": "anthropic", "api_key": "sk-test", "model_id": "", "region": ""},
    }
    r = client.post("/tailor", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["cover_letter"] == "Short and clean."
    assert data["rounds"] == [{"round": 1, "source": "loop", "findings": []}]
    assert client.get(data["cv_pdf"]).status_code == 200
    assert client.get(data["letter_pdf"]).headers["content-type"] == "application/pdf"


def test_answer_returns_one_answer_per_field(monkeypatch):
    from agent.answers import Answer
    monkeypatch.setattr(app_module, "build_model", lambda cfg: object())
    monkeypatch.setattr(app_module, "make_answerer", lambda model: None)
    seen = {}

    def fake_answer_fields(answerer, fields, profile, cv, title, company, known=()):
        seen["known"] = [(k.question, k.answer) for k in known]
        return [Answer(id=f.id, value=None if f.kind == "prompt" else "5", reason="cv") for f in fields]

    monkeypatch.setattr(app_module, "answer_fields", fake_answer_fields)
    client = TestClient(app_module.app)
    body = {"fields": [{"id": "years", "label": "Years", "kind": "text"},
                       {"id": "source", "label": "Source", "kind": "prompt", "required": True}],
            "profile": {"first_name": "Keith", "notes": ""}, "cv_text": "cv", "posting_title": "Analyst", "company": "Acme",
            "provider": {"name": "anthropic", "api_key": "sk-test", "model_id": "", "region": ""},
            "known_answers": [{"question": "Notice period", "answer": "3 months"}]}
    r = client.post("/answer", json=body)
    assert r.status_code == 200, r.text
    assert r.json() == {"answers": [{"id": "years", "value": "5", "reason": "cv"}, {"id": "source", "value": None, "reason": "cv"}]}
    assert seen["known"] == [("Notice period", "3 months")]


def test_tailor_bad_provider_is_400():
    client = TestClient(app_module.app)
    body = {"posting": {"title": "", "company": "", "location": "", "description": "", "url": ""},
            "cv_text": "x", "provider": {"name": "nope", "api_key": "k", "model_id": "", "region": ""}}
    assert client.post("/tailor", json=body).status_code == 400


def test_tailor_empty_cv_is_400_before_any_model_call(monkeypatch):
    monkeypatch.setattr(app_module, "build_model", lambda cfg: pytest.fail("build_model must not run"))
    client = TestClient(app_module.app)
    body = {"posting": {"title": "Analyst", "company": "Acme", "location": "", "description": "Python", "url": ""},
            "cv_text": "   ", "provider": {"name": "bedrock", "api_key": "", "model_id": "", "region": ""}}
    r = client.post("/tailor", json=body)
    assert r.status_code == 400
    assert "Upload your CV" in r.json()["detail"]


def test_tailor_model_failure_is_502_with_the_provider_message(monkeypatch):
    def boom(*args):
        raise RuntimeError("anthropic.claude-sonnet-5 is not available for this account")
    monkeypatch.setattr(app_module, "tailor", boom)
    monkeypatch.setattr(app_module, "build_model", lambda cfg: object())
    client = TestClient(app_module.app)
    body = {"posting": {"title": "Analyst", "company": "Acme", "location": "", "description": "Python", "url": ""},
            "cv_text": "Keith So.", "provider": {"name": "bedrock", "api_key": "", "model_id": "", "region": ""}}
    r = client.post("/tailor", json=body)
    assert r.status_code == 502
    assert "not available for this account" in r.json()["detail"]


def test_files_rejects_traversal():
    client = TestClient(app_module.app)
    assert client.get("/files/..%2F.env").status_code in (400, 404)
