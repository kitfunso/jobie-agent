from fastapi.testclient import TestClient
import server.app as app_module
from agent.writer import Round, TailorOutcome, TailorResult


def fake_tailor(model, title, company, location, description, cv_text):
    return TailorOutcome(
        TailorResult(cv_markdown="# Keith So\n\n- Python", cover_letter="Short and clean.", changes=["x"], gaps=[]),
        (Round(1, ()),),
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
    assert data["rounds"] == [{"round": 1, "findings": []}]
    assert client.get(data["cv_pdf"]).status_code == 200
    assert client.get(data["letter_pdf"]).headers["content-type"] == "application/pdf"


def test_tailor_bad_provider_is_400():
    client = TestClient(app_module.app)
    body = {"posting": {"title": "", "company": "", "location": "", "description": "", "url": ""},
            "cv_text": "x", "provider": {"name": "nope", "api_key": "k", "model_id": "", "region": ""}}
    assert client.post("/tailor", json=body).status_code == 400


def test_files_rejects_traversal():
    client = TestClient(app_module.app)
    assert client.get("/files/..%2F.env").status_code in (400, 404)
