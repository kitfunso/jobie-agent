"""The Workday beacon pill: appears, asks the background to open the side panel, and stays dismissed."""
from pathlib import Path

import pytest

pytest.importorskip("playwright")
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

CHROME_PATH = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
if not CHROME_PATH.exists():
    pytest.skip("Chrome not found at expected install path", allow_module_level=True)

ROOT = Path(__file__).resolve().parents[1]
BEACON_JS = (ROOT / "extension" / "content" / "beacon.js").read_text(encoding="utf-8")
FAKE_PAGE_URL = (ROOT / "extension" / "test" / "fake-workday.html").as_uri()
CHROME_STUB = (
    "window.__sent = []; window.chrome = {runtime: {getURL: p => p, lastError: null,"
    " sendMessage: (m, cb) => { window.__sent.push(m); if (cb) cb(); }}}"
)


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
    pg.goto(FAKE_PAGE_URL)
    pg.evaluate(CHROME_STUB)
    pg.add_script_tag(content=BEACON_JS)
    yield pg
    pg.close()


def test_beacon_pill_asks_background_to_open_the_panel(page):
    assert page.locator("#jobie-beacon").count() == 1
    page.locator("#jobie-beacon #open").click()
    assert page.evaluate("window.__sent") == [{"type": "open_side_panel"}]


def test_beacon_dismissal_sticks_for_the_tab(page):
    page.locator("#jobie-beacon #close").click()
    assert page.locator("#jobie-beacon").count() == 0
    assert page.evaluate("sessionStorage.getItem('jobie-beacon-dismissed')") == "1"
    page.add_script_tag(content=BEACON_JS)
    assert page.locator("#jobie-beacon").count() == 0


def test_beacon_never_runs_without_the_extension_api(page):
    page.locator("#jobie-beacon #close").click()
    page.evaluate("sessionStorage.clear(); window.chrome = undefined")
    page.add_script_tag(content=BEACON_JS)
    assert page.locator("#jobie-beacon").count() == 0
