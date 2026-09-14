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


def load_step(page, step: str | None = None, posting: bool = False) -> None:
    # Real Workday keeps the posting's /job/{slug}_{reqId} path on every apply page; the file:// fixture has no such
    # segment, so the query string supplies it for the posting case and, with posting=True, for an apply page too.
    query = [f"step={step}"] if step else []
    if posting or not step:
        query.append("posting=/job/123456")
    page.goto(FAKE_PAGE_URL + "?" + "&".join(query))
    for name in ["fill.js", "workday-selectors.js", "workday.js", "generic.js"]:
        page.add_script_tag(content=(CONTENT_DIR / name).read_text(encoding="utf-8"))
    # main.js reads chrome.runtime; the fake page has no extension host, so stub the API and keep the listener.
    page.evaluate("window.chrome = {runtime: {onMessage: {addListener: fn => { window.__listener = fn; }}}}")
    page.add_script_tag(content=(CONTENT_DIR / "main.js").read_text(encoding="utf-8"))


def test_scrape_posting(page):
    load_step(page)
    assert page.evaluate("Workday.isPosting()") is True
    posting = page.evaluate("Workday.scrape()")
    assert posting["title"] == "Senior Data Engineer"
    assert posting["company"] == "Sample Co"
    assert "freight and pricing" in posting["description"]
    assert posting["location"] == "London, United Kingdom"


def test_message_listener_answers_ping_and_scrape(page):
    load_step(page)
    ping = page.evaluate("new Promise(r => window.__listener({type: 'ping'}, {}, r))")
    assert ping == {"ok": True}
    scraped = page.evaluate("new Promise(r => window.__listener({type: 'scrape'}, {}, r))")
    assert scraped["ok"] is True
    assert scraped["posting"]["title"] == "Senior Data Engineer"


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
    assert page.input_value("#firstName") == "Keith"
    assert page.input_value("#lastName") == "So"
    assert page.input_value("#city") == "London"
    assert page.input_value("#phoneNumber") == "07700900000"
    assert page.text_content("#country") == "United Kingdom"
    assert page.text_content("#phoneType") == "Mobile"
    chip = page.text_content('[data-automation-id="formField-countryPhoneCode"] [data-automation-id="selectedItem"]')
    assert chip == "United Kingdom (+44)"
    assert {"first name", "last name", "city", "phone", "country", "phone type", "country phone code"}.issubset(set(result["filled"]))
    # fake page has no email input on this step, so the fill skips it; not a resume/files skip on this step.
    assert any("how did you hear" in s for s in result["skipped"])
    # the one required field the profile cannot answer is what the panel reports before it presses Save and Continue
    assert page.evaluate("Workday.pageInfo().unanswered") == ["How Did You Hear About Us?"]


def test_apply_pages_are_told_from_the_posting_by_the_progress_bar(page):
    load_step(page, "questions", posting=True)
    assert page.evaluate("Workday.isPosting()") is False
    assert page.evaluate("Workday.isApplication()") is True
    info = page.evaluate("Workday.pageInfo()")
    assert info["step"] == "questions"
    assert info["stepName"] == "Application Questions"
    assert info["unanswered"] == ["Years of experience", "Right to work in the UK", "Have you worked here before?", "I agree to the privacy notice"]


def test_sign_in_page_is_its_own_step(page):
    load_step(page, "signin", posting=True)
    assert page.evaluate("Workday.isPosting()") is False
    assert page.evaluate("Workday.pageInfo().step") == "signIn"


def test_form_fields_and_apply_answers_on_the_questions_page(page):
    load_step(page, "questions", posting=True)
    fields = page.evaluate("async () => await Workday.formFields()")
    by_id = {f["id"]: f for f in fields}
    assert by_id["rightToWork"] == {"id": "rightToWork", "label": "Right to work in the UK", "kind": "dropdown",
                                    "required": True, "options": ["Yes", "No"], "value": ""}
    assert by_id["previousWorker"]["kind"] == "radio" and by_id["previousWorker"]["options"] == ["Yes", "No"]
    assert by_id["consent"]["kind"] == "checkbox"
    assert by_id["notice"]["required"] is False
    # reading a dropdown's options opens its list; it must be closed again before anything else is clicked
    assert page.evaluate('document.querySelectorAll("ul[role=listbox]").length') == 0
    answers = [{"id": "yearsExperience", "value": "5"}, {"id": "rightToWork", "value": "Yes"},
               {"id": "previousWorker", "value": "No"}, {"id": "consent", "value": "Yes"},
               {"id": "notice", "value": None}, {"id": "nope", "value": "x"}]
    result = page.evaluate("async (a) => await Workday.applyAnswers(a)", answers)
    assert page.input_value("#yearsExperience") == "5"
    assert page.text_content("#rightToWork") == "Yes"
    assert page.is_checked("#previousWorkerNo")
    assert page.is_checked("#consent")
    assert page.evaluate("Workday.unansweredRequired()") == []
    assert set(result["filled"]) == {"Years of experience", "Right to work in the UK", "Have you worked here before?", "I agree to the privacy notice"}
    assert any("nope" in s for s in result["skipped"])


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


def test_page_info_and_advance_report_workday_errors(page):
    load_step(page, "info")
    info = page.evaluate("Workday.pageInfo()")
    assert info["step"] == "myInformation"
    assert info["nextButton"] == "Save and Continue"
    assert info["errors"] == []
    # empty required field: the fake page shows an error instead of moving on, as Workday does
    assert page.evaluate("Workday.advance()") == {"ok": True, "clicked": "Save and Continue"}
    assert page.evaluate("Workday.pageInfo().errors") == ["First Name is required"]


def test_advance_moves_to_the_next_step_after_a_fill(page):
    load_step(page, "info")
    page.evaluate("async (d) => await Workday.fill(d)", {"profile": PROFILE, "cover_letter": "", "files": []})
    assert page.evaluate("Workday.advance()")["ok"] is True
    page.wait_for_url(lambda url: "step=experience" in url)
    assert page.query_selector('[data-automation-id="myExperiencePage"]') is not None


def test_advance_never_clicks_submit_on_the_review_page(page):
    load_step(page, "review")
    assert page.evaluate("Workday.isApplication()") is True
    assert page.evaluate("Workday.pageInfo().step") == "review"
    assert page.evaluate("Workday.pageInfo().nextButton") == "Submit"
    result = page.evaluate("Workday.advance()")
    assert result["ok"] is False
    assert "Submit" in result["reason"]
    assert page.evaluate("document.body.dataset.clicked") is None
    assert page.evaluate("document.body.dataset.submitted") is None


def test_generic_fill(page):
    load_step(page, "info")
    result = page.evaluate(
        "async (data) => await Generic.fill(data)",
        {"profile": PROFILE, "cover_letter": "", "files": []},
    )
    has_labels = page.evaluate('!!document.querySelector(\'label[for="firstName"]\')')
    if has_labels:
        assert page.input_value("#firstName") == "Keith"
        assert any("given name" in s for s in result["filled"])
    else:
        assert result["ok"] is True
