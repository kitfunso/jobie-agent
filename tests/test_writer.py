import json

from agent.slop import Finding
from agent.writer import Generation, TailorResult, run_loop, self_checks

DIRTY = "I am writing to express my interest. I leverage robust tools."
CLEAN = "Your posting asks for Python in production. At Unipec I run it daily against a 20 TB lake."


def _gen(letter: str, checks: tuple = ()) -> Generation:
    return Generation(TailorResult(cv_markdown="# Keith So\n\n- Python", cover_letter=letter, changes=[], gaps=[]), checks)


def test_loop_stops_at_zero_findings():
    calls = []

    def generate(prompt: str) -> Generation:
        calls.append(prompt)
        return _gen(DIRTY if len(calls) == 1 else CLEAN)

    outcome = run_loop(generate, "first prompt", max_rounds=3)
    assert len(calls) == 2
    assert [(r.round, r.source, bool(r.findings)) for r in outcome.rounds] == [(1, "loop", True), (2, "loop", False)]
    assert "leverage" in calls[1] or "banned word" in calls[1]


def test_loop_gives_up_after_max_rounds():
    def generate(prompt: str) -> Generation:
        return _gen(DIRTY)

    outcome = run_loop(generate, "p", max_rounds=2)
    assert len(outcome.rounds) == 2
    assert outcome.result.cover_letter == DIRTY
    assert outcome.rounds[-1].findings


def test_default_is_two_rounds():
    def generate(prompt: str) -> Generation:
        return _gen(DIRTY)

    assert len(run_loop(generate, "p").rounds) == 2


def test_agent_self_checks_are_listed_before_the_loop_check():
    seen = (Finding("banned word", "I leverage tools.", "say use"),)

    def generate(prompt: str) -> Generation:
        return _gen(CLEAN, checks=(seen, ()))

    outcome = run_loop(generate, "p")
    assert [(r.round, r.source, len(r.findings)) for r in outcome.rounds] == [(1, "agent", 1), (1, "agent", 0), (1, "loop", 0)]


def test_self_checks_reads_only_slop_check_tool_results():
    payload = json.dumps({"count": 1, "findings": [{"rule": "banned word", "quote": "I leverage tools.", "fix": "say use"}]})
    messages = [
        {"role": "user", "content": [{"text": "draft please"}]},
        {"role": "assistant", "content": [{"toolUse": {"toolUseId": "t1", "name": "slop_check", "input": {"text": "x"}}}]},
        {"role": "user", "content": [{"toolResult": {"toolUseId": "t1", "status": "success", "content": [{"text": payload}]}}]},
        {"role": "assistant", "content": [{"toolUse": {"toolUseId": "t2", "name": "TailorResult", "input": {}}}]},
    ]
    checks = self_checks(messages)
    assert len(checks) == 1
    assert checks[0] == (Finding("banned word", "I leverage tools.", "say use"),)


def test_loop_checks_letter_numbers_against_the_cv():
    def generate(prompt: str) -> Generation:
        return _gen("At Unipec I run Python daily against a 20 TB lake across five desks.")

    rules = lambda outcome: {f.rule for f in outcome.rounds[0].findings}
    assert "unsourced number" in rules(run_loop(generate, "p", cv="Python daily against a 20 TB lake."))
    assert "unsourced number" not in rules(run_loop(generate, "p"))
