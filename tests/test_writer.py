from agent.writer import TailorResult, run_loop

DIRTY = "I am writing to express my interest. I leverage robust tools."
CLEAN = "Your posting asks for Python in production. At Unipec I run it daily against a 20 TB lake."


def test_loop_stops_at_zero_findings():
    calls = []

    def generate(prompt: str) -> TailorResult:
        calls.append(prompt)
        letter = DIRTY if len(calls) == 1 else CLEAN
        return TailorResult(cv_markdown="# Keith So\n\n- Python", cover_letter=letter, changes=[], gaps=[])

    outcome = run_loop(generate, "first prompt", max_rounds=3)
    assert len(calls) == 2
    assert [len(r.findings) for r in outcome.rounds] == [len(outcome.rounds[0].findings), 0]
    assert outcome.rounds[0].findings
    assert "leverage" in calls[1] or "banned word" in calls[1]


def test_loop_gives_up_after_max_rounds():
    def generate(prompt: str) -> TailorResult:
        return TailorResult(cv_markdown="# x", cover_letter=DIRTY, changes=[], gaps=[])

    outcome = run_loop(generate, "p", max_rounds=2)
    assert len(outcome.rounds) == 2
    assert outcome.result.cover_letter == DIRTY
    assert outcome.rounds[-1].findings
