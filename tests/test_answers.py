from agent.answers import Answer, FormAnswers, FormField, KnownAnswer, answer_fields, answer_prompt

FIELDS = [
    FormField(id="rightToWork", label="Right to work in the UK", kind="dropdown", required=True, options=["Yes", "No"]),
    FormField(id="source", label="How Did You Hear About Us?", kind="prompt", required=True),
    FormField(id="years", label="Years of experience", kind="text"),
    FormField(id="consent", label="I agree", kind="checkbox", required=True),
]


def test_options_are_enforced_and_every_field_gets_an_answer():
    def answerer(prompt: str) -> FormAnswers:
        assert "Right to work" in prompt and "NOTES" in prompt
        return FormAnswers(answers=[
            Answer(id="rightToWork", value="yes", reason="notes"),
            Answer(id="source", value="LinkedIn", reason="notes"),
            Answer(id="consent", value="true", reason="notes"),
            Answer(id="made-up", value="x", reason=""),
        ])

    out = answer_fields(answerer, FIELDS, {"notes": "right to work: yes"}, "cv")
    assert [(a.id, a.value) for a in out] == [("rightToWork", "Yes"), ("source", "LinkedIn"), ("years", None), ("consent", "Yes")]
    assert out[2].reason == "no answer from the model"


def test_a_value_outside_the_options_is_dropped_with_a_reason():
    def answerer(prompt: str) -> FormAnswers:
        return FormAnswers(answers=[Answer(id="rightToWork", value="Yes, settled status", reason="notes")])

    out = answer_fields(answerer, FIELDS[:1], {}, "")
    assert out[0].value is None
    assert "not one of the options" in out[0].reason


def test_prompt_keeps_notes_apart_from_profile_facts():
    text = answer_prompt(FIELDS, {"first_name": "Keith", "notes": "never worked at EDF", "linkedin": ""}, "CV BODY", "Analyst", "EDF")
    assert '"first_name": "Keith"' in text and '"linkedin"' not in text
    assert "NOTES\nnever worked at EDF" in text and "CV BODY" in text
    assert "ANSWERS FROM EARLIER APPLICATIONS\n(none)" in text


def test_earlier_answers_reach_the_prompt():
    known = [KnownAnswer(question="What is your current notice period?", answer="3 months")]
    text = answer_prompt(FIELDS, {}, "", "Analyst", "EDF", known)
    assert "ANSWERS FROM EARLIER APPLICATIONS\n- Q: What is your current notice period?\n  A: 3 months" in text

    def answerer(prompt: str) -> FormAnswers:
        assert "A: 3 months" in prompt
        return FormAnswers(answers=[])

    out = answer_fields(answerer, FIELDS[:1], {}, "", known=known)
    assert out[0].value is None
