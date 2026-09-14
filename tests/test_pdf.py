from io import BytesIO
from pypdf import PdfReader
from agent.pdf import render_markdown_pdf

MD = "# Keith So\n\nLondon, kit@example.com\n\n## Experience\n\n- **Unipec** 2021 to now: cut errors 40 to 3\n- Second bullet\n"


def test_renders_headings_and_bullets(tmp_path):
    out = render_markdown_pdf(MD, tmp_path / "cv.pdf")
    assert out.stat().st_size > 1000
    text = PdfReader(BytesIO(out.read_bytes())).pages[0].extract_text()
    assert "Keith So" in text and "Experience" in text and "Second bullet" in text
