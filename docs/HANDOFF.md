# Handoff, 14 Sep 2026, leaving the work laptop

Everything is on `main` at origin, HEAD `a4bf218`, tree clean, suite 46 passed.
Deadline: Devpost "Agents for Humans", 15 Sep 2026 01:00 BST (14 Sep 17:00 PDT). Code freeze target 22:00 BST.

## Set up on the home laptop

```
git clone https://github.com/kitfunso/jobie-agent.git
cd jobie-agent
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
```

Put a Bedrock API key in `.env` as `AWS_BEARER_TOKEN_BEDROCK`. The existing key's value lives only in the work laptop's `.env`, so make a new one in the AWS console (Bedrock, API keys, long-term) if you do not have it written down. Region stays `us-east-1`. Then `scripts\run-server.cmd`, and in Chrome load `extension/` unpacked. Profile and CV are stored in the extension, so upload the CV again on the new machine.

`samples/` (real CV and posting) is git-ignored and only feeds `python -m scripts.smoke`. The panel does not need it.

Tests: `.venv\Scripts\python.exe -m pytest tests -q`.

## Today's commits, newest first

- `a4bf218` scripts/enable_model.py and scripts/bedrock-enable-policy.json, README note.
- `8e05716` Tailor progress row (beam, pulsing dot, elapsed clock), /tailor answers 502 with the provider's message, Bedrock default back to Sonnet 4.6.
- `c367c76` Bedrock default to Sonnet 5 (undone by 8e05716, see below).
- `d4930dd` letter brief in a human voice, posting-echo and no-contractions checks.
- Earlier today: beacon pill and WD badge, collapsible stages, inject into open Workday tabs, panel busy state and status banner above the footer.

## Sonnet 5 on Bedrock, unresolved

- Bedrock says the account is authorised and entitled, and the Marketplace agreement for Claude Sonnet 5 (Amazon Bedrock Edition) is live since 14 Sep 16:04 UTC at 0.00 USD. The inline policy `enable-bedrock-models` is attached to the IAM user `BedrockAPIKey-ft4r`.
- Converse on `global.anthropic.claude-sonnet-5` and `us.anthropic.claude-sonnet-5` still returns `AccessDeniedException: anthropic.claude-sonnet-5 is not available for this account ... contact AWS Sales`, checked once a minute for several minutes after the agreement went live. Sonnet 4.6 on the same key answers.
- Try one more call later (`python scripts/enable_model.py` prints the status and makes one 5-token call). If it still refuses, the route to Sonnet 5 today is the Anthropic provider: key from console.anthropic.com, Provider `anthropic` in the panel, Model id empty (default `claude-sonnet-5`).
- The Bedrock default in `agent/providers.py` and `extension/sidepanel.js` is `global.anthropic.claude-sonnet-4-6`. Flip both plus `tests/test_providers.py` and the README table if Sonnet 5 starts working.

## Left before freeze

1. `extension/manifest.json`: remove the `file:///*/extension/test/*` entry from `content_scripts` matches and the `file:///*` entry from `web_accessible_resources`. Tests use the fake page through Playwright, not the manifest match.
2. Tag `v0.1.0` and push the tag.
3. Task 9: a real application on the EDF posting with Run to review, fixing form selectors as they show up. Posting-page scrape is verified on edftrading.wd1; form pages are not.
4. Task 11: video under 5 minutes, unlisted YouTube, Devpost form. Script in `docs/demo-script.md`, text in `docs/devpost.md`.
5. The human-voice brief from `d4930dd` has not been confirmed on a real run yet. Read the next letter with fresh eyes.

## After the hackathon

- Rotate the Bedrock API key in the console. It was pasted in a chat once.
- The run button has an `is-running` beam class in the CSS that the script never sets. Wire it or drop it.
