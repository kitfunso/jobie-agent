"""Drives the fake Workday page with real Chrome to exercise the content scripts end to end."""
import base64
from pathlib import Path

import pytest

pytest.importorskip("playwright")
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from agent.pdf import render_markdown_pdf

CHROME_PATH = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
if not CHROME_PATH.exists():
    pytest.skip("Chrome not found at expected install path", allow_module_level=True)

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "extension" / "content"
FAKE_PAGE_URL = (ROOT / "extension" / "test" / "fake-workday.html").as_uri()
PROFILE = {
    "first_name": "Keith", "last_name": "So", "email": "k@example.com", "phone": "07700900000",
    "country": "United Kingdom", "city": "London", "linkedin": "",
}


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel="chrome", headless=True)
        except PlaywrightError:
            b = p.chromium.launch(executable_path=str(CHROME_PATH), headless=True)
        yield b
        b.close()


@pytest.fixture
def page(browser):
    pg = browser.new_page()
    yield pg
    pg.close()


def load_step(page, step: str | None = None) -> None:
    # isPosting() requires a "/job/" URL segment (real Workday posting URLs look like /job/{slug}_{reqId});
    # the file:// fixture has no such path segment, so the query string simulates it for the posting case.
    url = FAKE_PAGE_URL + (f"?step={step}" if step else "?posting=/job/123456")
    page.goto(url)
    for name in ["fill.js", "workday-selectors.js", "workday.js", "generic.js"]:
        page.add_script_tag(content=(CONTENT_DIR / name).read_text(encoding="utf-8"))
    # main.js reads chrome.runtime; the fake page has no extension host, so stub the API it touches.
    page.evaluate("window.chrome = {runtime: {onMessage: {addListener: function () {}}}}")
    page.add_script_tag(content=(CONTENT_DIR / "main.js").read_text(encoding="utf-8"))


def test_scrape_posting(page):
    load_step(page)
    assert page.evaluate("Workday.isPosting()") is True
    posting = page.evaluate("Workday.scrape()")
    assert posting["title"] == "Senior Data Engineer"
    assert posting["company"] == "Sample Co"
    assert "freight and pricing" in posting["description"]
    assert posting["location"] == "London, United Kingdom"


def test_posting_url_pattern_accepts_details_and_job(page):
    load_step(page)
    for path in ["/en-US/EDFTrading/details/Senior-Quantitative-Analyst_JR1001455", "/en-US/Site/job/Role_R123"]:
        assert page.evaluate("p => WD.pages.postingUrlPattern.test('https://x.myworkdayjobs.com' + p)", path) is True
    assert page.evaluate("WD.pages.postingUrlPattern.test('https://x.myworkdayjobs.com/en-US/Site')") is False


def test_fill_info_step(page):
    load_step(page, "info")
    assert page.evaluate("Workday.isApplication()") is True
    result = page.evaluate(
        "async (data) => await Workday.fill(data)",
        {"profile": PROFILE, "cover_letter": "", "files": []},
    )
    assert page.input_value('input[data-automation-id="legalNameSection_firstName"]') == "Keith"
    assert page.input_value('input[data-automation-id="legalNameSection_lastName"]') == "So"
    assert page.input_value('input[data-automation-id="addressSection_city"]') == "London"
    assert page.input_value('input[data-automation-id="phone-number"]') == "07700900000"
    country_text = page.evaluate('document.querySelector(\'[data-automation-id="addressSection_countryRegion"]\').textContent')
    assert "United Kingdom" in country_text
    assert {"first name", "last name", "city", "phone", "country"}.issubset(set(result["filled"]))
    # fake page has no email input on this step, so the fill skips it; not a resume/files skip on this step.
    assert any("how did you hear" in s for s in result["skipped"])


def test_fill_experience_step(page, tmp_path):
    pdf_path = render_markdown_pdf("# CV\n\nTiny test CV body.", tmp_path / "cv.pdf")
    b64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    load_step(page, "experience")
    result = page.evaluate(
        "async (data) => await Workday.fill(data)",
        {"profile": {}, "cover_letter": "Hello", "files": [{"name": "cv.pdf", "b64": b64}]},
    )
    assert result["ok"] is True
    rows = page.query_selector_all('[data-automation-id="file-upload-successful"]')
    assert len(rows) >= 1
    letter_value = page.input_value('textarea[data-automation-id="coverLetter"]')
    assert "Hello" in letter_value


def test_generic_fill(page):
    load_step(page, "info")
    result = page.evaluate(
        "async (data) => await Generic.fill(data)",
        {"profile": PROFILE, "cover_letter": "", "files": []},
    )
    has_labels = page.evaluate('!!document.querySelector(\'label[for="firstName"]\')')
    if has_labels:
        assert page.input_value("#firstName") == "Keith"
        assert any("first name" in s for s in result["filled"])
    else:
        assert result["ok"] is True
