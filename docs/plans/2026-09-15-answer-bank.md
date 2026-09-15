# Answer bank: learn every application question once

**Goal:** Run to review reaches the Review page on a Workday application without the user retyping facts. Every question a form asks is recorded. A question the profile, notes, CV and earlier answers cannot cover is put to the user once, inside the panel, and the answer is kept for the next application.

**Why now:** the 14 Sep live run on edftrading.wd1 stopped at step 3 of 5 on "Are you legally permitted to work in the country where this job is located?", "What is your current notice period?" and "What is your desired annual salary?". The panel told the user to answer on the page and click Run to review again. Nothing was kept, so the next application would stop on the same three questions.

## Contracts

### Storage (extension, `chrome.storage.local.answers`)

```json
{
  "<key>": {
    "question": "What is your current notice period?",
    "answer": "3 months",
    "kind": "text",
    "options": [],
    "required": true,
    "company": "EDF Trading",
    "asked": 2,
    "source": "user",
    "first_seen": "2026-09-15T10:00:00Z",
    "last_used": "2026-09-15T10:00:00Z"
  }
}
```

`key` is the question label lower-cased, punctuation stripped, whitespace collapsed. Company-specific wording ("Have you previously worked for EDFT?") keeps its own key on purpose: the answer may differ by company. `source` is `user` (typed in the panel), `agent` (the answer agent derived it from profile, notes or CV) or `profile` (copied from a profile field). `answer` is `""` for a question seen but not yet answered.

### `POST /answer` request gains `known_answers`

```json
{"fields": [...], "profile": {...}, "cv_text": "", "posting_title": "", "company": "", "provider": {...},
 "known_answers": [{"question": "Notice period", "answer": "3 months"}]}
```

The prompt lists them under `ANSWERS FROM EARLIER APPLICATIONS`. The system prompt says: when a field asks the same thing in other words, reuse the known answer and pick the option that matches it. Options are still enforced in Python.

### Content script (`Workday.formFields()`)

Each field gains `profile: true` when the My Information filler owns it (name, email, phone, country, city, address, postal code, phone type, phone code, extension). The bank skips those.

### Panel messages

No new message types. The page loop uses `form_fields` and `apply_answers` as today.

## Flow per page inside Run to review

1. Profile fill (as today).
2. `fields = form_fields`. Upsert every non-profile field into the bank: `asked += 1`, keep an existing answer, record kind, options, required, company. A field the page already holds a value for (Workday remembered it) is recorded with that value and `source: "profile"` only when the bank has no answer yet.
3. Bank pass, no tokens: every empty field whose key has a non-empty answer gets it through `apply_answers`. Where the field has options, the answer must equal one of them (case-insensitive) or it is skipped and logged.
4. Agent pass, only when a required field is still empty: `/answer` with `known_answers` = all answered bank entries. Applied answers are saved to the bank with `source: "agent"` and the reason kept in the log.
5. Still-empty required fields: the panel shows a **Workday asks** block under the run log, one control per field (select for dropdown, radio and checkbox; input for text and prompt; textarea for textarea), the question as the label and "required" marked. Buttons **Save and continue** and the existing **Stop**. The run awaits the click. On Save: entries go to the bank with `source: "user"`, the values go to the page through `apply_answers`, and the loop re-checks. Anything still empty (a value Workday rejected) shows again with the skip reason. Stop ends the run as today.
6. Advance (as today).

**Fill this page** runs steps 1 to 5 and stops.

## Panel: stage 1 gains an Answers fieldset

Under Set up once, after Profile: a summary line "N answered, M waiting" and a list, waiting questions first, each with the question text, the company it came from, and an editable control (select when options are known, else input). A Save button writes the bank. This is where the user pre-fills answers for questions they know are coming, and edits an answer that has changed.

## Files

| File | Change |
|---|---|
| `extension/answer-bank.js` (new, pure functions, global `AnswerBank`) | `keyOf`, `recordAsked`, `recordAnswers`, `matches`, `known`, `waiting` |
| `extension/sidepanel.js` | bank load and save; per-page steps 2 to 5; the Workday asks block; the Answers fieldset render and save; Fill this page shares the code |
| `extension/sidepanel.html`, `sidepanel.css` | Answers fieldset in stage 1; Workday asks block in stage 3 |
| `extension/content/workday.js` | `profile: true` on profile-owned fields; drop the "how did you hear about us: yours to answer" skip line |
| `agent/answers.py` | `known_answers` in the prompt and the system prompt |
| `server/schemas.py` | `AnswerRequest.known_answers` |
| `tests/test_answer_bank.py` (new) | Playwright drives `answer-bank.js`: key normalisation, record, match with options, waiting list |
| `tests/test_answers.py`, `tests/test_server.py`, `tests/test_fake_page.py` | known answers reach the prompt; schema accepts the field; the info step no longer reports the "how did you hear" skip |
| `README.md` | one paragraph on the answer bank |

## Out of scope

Work experience and education entries on My Experience (Workday's Add buttons) stay as they are: the CV upload and Workday's own resume parse cover them. The Nebius provider is a separate commit.

## Checks

- Fake page: a questions page with three required fields the profile does not cover goes through bank pass, then agent pass (stubbed), then the Workday asks block, then advances after Save and continue; the second visit to the same page needs no agent call and no user input.
- Live: edftrading.wd1 Senior Quantitative Analyst, from My Information to Review, with the automation Chrome on port 9222. Every step's questions land in the bank.
- Suite green.
