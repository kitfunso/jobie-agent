"""Drives extension/answer-bank.js in a blank page: the bank logic has no DOM and no chrome API on purpose."""
from pathlib import Path

import pytest

pytest.importorskip("playwright")
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

CHROME_PATH = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
if not CHROME_PATH.exists():
    pytest.skip("Chrome not found at expected install path", allow_module_level=True)

BANK_JS = Path(__file__).resolve().parents[1] / "extension" / "answer-bank.js"
NOW = "2026-09-15T10:00:00Z"
FIELDS = [
    {"id": "legalName--firstName", "label": "Given Name(s)", "kind": "text", "required": True, "options": [], "value": "", "profile": True},
    {"id": "rightToWork", "label": "Are you legally permitted to work in the UK?", "kind": "radio", "required": True,
     "options": ["Yes", "No - I need sponsorship"], "value": "", "profile": False},
    {"id": "notice", "label": "What is your current notice period?", "kind": "text", "required": True, "options": [], "value": "", "profile": False},
    {"id": "salary", "label": "What is your desired annual salary?", "kind": "text", "required": True, "options": [], "value": "", "profile": False},
    {"id": "preferred", "label": "I have a preferred name", "kind": "checkbox", "required": False, "options": ["Yes", "No"], "value": "", "profile": False},
    {"id": "school", "label": "School or University", "kind": "text", "required": True, "options": [], "value": "Strathclyde", "profile": False},
]


@pytest.fixture(scope="module")
def page():
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="chrome", headless=True)
        except PlaywrightError:
            browser = p.chromium.launch(executable_path=str(CHROME_PATH), headless=True)
        pg = browser.new_page()
        pg.goto("about:blank")
        pg.add_script_tag(content=BANK_JS.read_text(encoding="utf-8"))
        yield pg
        browser.close()


def test_key_drops_punctuation_case_and_spacing(page):
    assert page.evaluate("AnswerBank.keyOf('  What is your Current notice-period?* ')") == "what is your current notice period"


def test_record_asked_skips_profile_fields_and_counts_visits(page):
    bank = page.evaluate("f => AnswerBank.recordAsked({}, f, 'EDF Trading', %r)" % NOW, FIELDS)
    assert "given name s" not in bank
    # Workday filled the school from a saved draft, so the user was not asked it this time
    assert "school or university" not in bank
    entry = bank["what is your current notice period"]
    assert entry == {"question": "What is your current notice period?", "answer": "", "source": "", "asked": 1, "first_seen": NOW,
                     "kind": "text", "options": [], "required": True, "company": "EDF Trading", "last_seen": NOW}
    again = page.evaluate("([b, f]) => AnswerBank.recordAsked(b, f, 'Acme', 'later')", [bank, FIELDS])
    assert again["what is your current notice period"]["asked"] == 2
    assert again["what is your current notice period"]["company"] == "Acme"
    assert [e["question"] for e in page.evaluate("b => AnswerBank.waiting(b)", again)] == [
        "Are you legally permitted to work in the UK?", "What is your current notice period?", "What is your desired annual salary?"]


def test_answers_are_kept_and_reused_across_companies_with_exact_options_only(page):
    bank = page.evaluate("f => AnswerBank.recordAsked({}, f, 'EDF Trading', %r)" % NOW, FIELDS)
    answers = [{"id": "notice", "value": "3 months"}, {"id": "rightToWork", "value": "Yes"}, {"id": "salary", "value": None},
               {"id": "legalName--firstName", "value": "Keith"}]
    bank = page.evaluate("([b, f, a]) => AnswerBank.recordAnswers(b, f, a, 'user', 'then')", [bank, FIELDS, answers])
    assert bank["what is your current notice period"]["answer"] == "3 months"
    assert bank["what is your current notice period"]["source"] == "user"
    assert bank["what is your desired annual salary"]["answer"] == ""
    assert "given name s" not in bank
    # a field the page grew after recordAsked ran still gets a complete entry
    fresh = page.evaluate("([f, a]) => AnswerBank.recordAnswers({}, f, a, 'agent', 'then', 'Acme')", [FIELDS, answers])
    assert fresh["what is your current notice period"]["company"] == "Acme" and fresh["what is your current notice period"]["asked"] == 1
    # the next company asks the same questions; one of them now offers a finer option list
    later = [dict(f) for f in FIELDS]
    later[1] = {**later[1], "options": ["No", "Yes, without restriction"]}
    result = page.evaluate("([b, f]) => AnswerBank.matches(b, f)", [bank, later])
    assert result["hits"] == [{"id": "notice", "value": "3 months"}]
    assert result["misses"] == ['Are you legally permitted to work in the UK?: saved answer "Yes" is not one of No, Yes, without restriction']
    assert page.evaluate("b => AnswerBank.answered(b).map(e => e.question)", bank) == ["Are you legally permitted to work in the UK?", "What is your current notice period?"]


def test_known_answers_for_the_model_share_a_word_with_an_open_field(page):
    bank = {
        "what is your current notice period": {"question": "What is your current notice period?", "answer": "3 months"},
        "how did you hear about us": {"question": "How did you hear about us?", "answer": "LinkedIn"},
        "unanswered": {"question": "Unanswered", "answer": ""},
    }
    fields = [{"id": "np", "label": "Notice period (weeks)", "kind": "text", "required": True, "options": [], "value": "", "profile": False}]
    assert page.evaluate("([b, f]) => AnswerBank.known(b, f)", [bank, fields]) == [{"question": "What is your current notice period?", "answer": "3 months"}]


def test_set_answer_edits_an_entry_in_place(page):
    bank = page.evaluate("f => AnswerBank.recordAsked({}, f, 'EDF Trading', %r)" % NOW, FIELDS)
    edited = page.evaluate("b => AnswerBank.setAnswer(b, 'what is your desired annual salary', ' 95000 ', 'now')", bank)
    assert edited["what is your desired annual salary"]["answer"] == "95000"
    assert edited["what is your desired annual salary"]["source"] == "user"
    assert page.evaluate("b => AnswerBank.setAnswer(b, 'missing', 'x', 'now') === b", bank) is True
