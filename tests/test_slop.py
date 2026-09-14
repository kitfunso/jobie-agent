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


def test_full_letter_without_contractions_is_flagged():
    stiff = "I built the pipeline at Unipec in 2021 and ran it. " * 14
    assert any(f.rule == "no contractions" for f in check(stiff, "letter"))
    assert not any(f.rule == "no contractions" for f in check(stiff + "I've kept it running since.", "letter"))
    assert not any(f.rule == "no contractions" for f in check("I built it. No contractions here.", "letter"))


def test_posting_echo_needs_eight_shared_words():
    posting = "You will build and run Python and SQL jobs against a multi-terabyte lake and cut error rates."
    echo = "At Unipec I would build and run Python and SQL jobs against a multi-terabyte lake every day."
    hits = [f for f in check(echo, "letter", posting) if f.rule == "posting echo"]
    assert hits and hits[0].quote.startswith("At Unipec")
    own_words = "At Unipec I ran the Python and SQL jobs on a lake of 40 TB and cut errors by half."
    assert not any(f.rule == "posting echo" for f in check(own_words, "letter", posting))
    assert not any(f.rule == "posting echo" for f in check(echo, "cv", posting))


def test_template_letter_phrases_are_cliches():
    text = ("Dear Hiring Manager, I am confident that my extensive experience aligns with your needs. "
            "I look forward to hearing from you. Thank you for considering my application.")
    assert len([f for f in check(text, "letter") if f.rule == "cover letter cliche"]) >= 4


def test_bridge_clause_is_named():
    text = ("That work sits at the same intersection your quant team operates in. I hedged a book, "
            "which gives me the desk context that matters. It's the direction I want to go.")
    assert len([f for f in check(text, "letter") if f.rule == "bridge clause"]) == 3


def test_number_pile_counts_ranges_as_one_and_ignores_years():
    pile = ("My spread model ran an IC of 0.44 over seven years, the engine covered 39 routes with hit "
            "rates of 78-84% and edge of +4.7 to +5.3 $/bbl.")
    assert any(f.rule == "number pile" for f in check(pile, "letter"))
    fine = ("It now covers 39 routes, with hit rates between 78 and 84% on the calls it has made. "
            "In the first half of 2024 that book made 600k against 150k of VaR.")
    assert not any(f.rule in ("number pile", "stat sheet") for f in check(fine, "letter"))


def test_stat_sheet_flags_more_than_six_numbers():
    text = " ".join(f"Job {i} cut costs by {i}0%." for i in range(1, 8))
    assert any(f.rule == "stat sheet" for f in check(text, "letter"))
    assert not any(f.rule == "number pile" for f in check(text, "letter"))


def test_close_cliches_and_flattery():
    text = "That's a harder problem than most desks face. I'd welcome a conversation about the role."
    names = {f.rule for f in check(text, "letter")}
    assert {"flattery", "cover letter cliche"} <= names


def test_sales_talk_is_letter_only():
    text = "Monte Carlo is in my daily toolkit and I test rigorously."
    assert any(f.rule == "sales talk" for f in check(text, "letter"))
    assert not any(f.rule == "sales talk" for f in check(text, "cv"))


def test_example_letter_passes_its_own_rules_and_cannot_be_lifted():
    from agent.slop_rules import EXAMPLE_LETTER
    assert {f.rule for f in check(EXAMPLE_LETTER, "letter")} <= {"example echo"}
    lifted = "Dear Sir,\n\nThe rota at Hillside was the job nobody wanted, so I took it.\n\nMe"
    assert any(f.rule == "example echo" for f in check(lifted, "letter"))
    assert not any(f.rule == "example echo" for f in check(CLEAN_LETTER, "letter"))


def test_unsourced_number_needs_the_cv():
    cv = "Built the engine across 36 routes over seven years with four traders. 1,200 tickets, +600k."
    letter = "I built the engine across 36 routes over seven years. It fits smiles across five tenors."
    unsourced = lambda text, **kw: [f.quote for f in check(text, "letter", **kw) if f.rule == "unsourced number"]
    assert unsourced(letter, cv=cv) == ["It fits smiles across five tenors."]
    assert unsourced(letter) == []
    assert unsourced("Four traders use it. It handled 1200 tickets, up 600k. Since 2019.", cv=cv) == []
    assert unsourced("Your 12 desks would use it.", cv=cv, posting="across our 12 desks") == []
    assert unsourced("Up £600k.", cv=cv) == ["Up £600k."]
