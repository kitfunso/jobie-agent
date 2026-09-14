from pathlib import Path
import pytest
from agent.cv import extract_text

# resolved from this file, not cwd, so the test works regardless of invocation directory
SAMPLE = Path(__file__).resolve().parents[1] / "samples" / "cv.pdf"


@pytest.mark.skipif(not SAMPLE.exists(), reason="local CV sample only")
def test_extracts_real_cv_text():
    text = extract_text(SAMPLE.read_bytes())
    assert len(text) > 500
    assert "\n" in text


def test_empty_pdf_raises():
    with pytest.raises(ValueError):
        extract_text(b"%PDF-1.4 not really")
