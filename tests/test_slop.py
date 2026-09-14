from agent.slop import check

CLEAN_LETTER = (
    "Dear Ms Patel,\n\nYour posting asks for someone who has cut settlement errors on a live "
    "trading desk. At Unipec I rebuilt the freight reconciliation job and errors fell from 40 a "
    "month to 3.\n\nThe role also needs Python and SQL in production. I run both daily against a "
    "20 TB lake and I wrote the sync script the desk still uses.\n\nI would like to talk about "
    "the crude desk work in the second paragraph of the posting. I am free any afternoon next week.\n\n"
    "Keith So"
)


def test_clean_letter_has_no_findings():
    assert check(CLEAN_LETTER, "letter") == ()


def test_banned_word_is_named_and_quoted():
    text = "I leverage a robust toolkit to delve into data."
    names = {f.rule for f in check(text, "letter")}
    assert "banned word" in names
    quotes = [f.quote for f in check(text, "letter")]
    assert any("leverage" in q for q in quotes)


def test_cover_letter_cliche():
    text = "I am writing to express my interest in the role. I have a proven track record."
    names = {f.rule for f in check(text, "letter")}
    assert "cover letter cliche" in names


def test_binary_contrast():
    text = "This is not just a job for me, but a calling."
    assert any(f.rule == "binary contrast" for f in check(text, "letter"))


def test_em_dash_flagged_in_letter_only():
    text = "I built the pipeline — it runs nightly."
    assert any(f.rule == "em dash" for f in check(text, "letter"))
    assert not any(f.rule == "em dash" for f in check(text, "cv"))


def test_summary_ending():
    text = "First point here.\n\nSecond point here.\n\nIn conclusion, I would be a great fit."
    assert any(f.rule == "summary ending" for f in check(text, "letter"))


def test_monotone_openers():
    text = "I did this. I did that. I did more. I did it again. I did it once more. I rest."
    assert any(f.rule == "monotone openers" for f in check(text, "letter"))


def test_too_long_letter():
    text = "word " * 400
    assert any(f.rule == "too long" for f in check(text, "letter"))


def test_colon_reveal_is_letter_only():
    text = "The best part: it learns."
    assert any(f.rule == "colon reveal" for f in check(text, "letter"))
    assert not any(f.rule == "colon reveal" for f in check(text, "cv"))


def test_cv_bullet_still_flags_banned_word():
    text = "- Built robust regression tests"
    names = {f.rule for f in check(text, "cv")}
    assert "banned word" in names


def test_cv_skills_line_has_no_findings():
    text = "Skills: Python, SQL, Excel."
    assert check(text, "cv") == ()


def test_word_boundary_avoids_substring_false_positive():
    text = "Realmside Ltd ran the utilities contract for the desk."
    assert check(text, "letter") == ()
