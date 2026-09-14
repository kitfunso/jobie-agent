# jobie-agent

A Chrome extension plus a local [Strands Agents](https://strandsagents.com) agent. It takes you from a Workday job posting to a filled application form, with your own model key, and without the AI writing tells that recruiters now look for.

You open a posting on any `*.myworkdayjobs.com` site. The side panel reads it. The agent rewrites your CV for that role and writes the cover letter using facts from your CV only. A deterministic checker scans both drafts for named AI-writing patterns and sends them back until they come out clean. The extension then fills the Workday form pages and attaches the PDFs. It never presses Submit. You read every page and submit yourself.

![architecture](docs/architecture.png)

## Quickstart

```
git clone https://github.com/kitfunso/jobie-agent.git
cd jobie-agent
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      (macOS or Linux: .venv/bin/pip)
copy .env.example .env                              (then put your key in .env)
scripts\run-server.cmd                              (or: python -m uvicorn server.app:app --host 127.0.0.1 --port 8765)
```

Then in Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `extension/` folder. Click the jobie-agent icon to open the side panel.

In the panel:

1. Pick a provider under **Settings** and click **Save**. Leave the key blank to use the one in `.env`.
2. Fill in **Profile** and click **Save**.
3. Upload your CV as a PDF under **CV**. It needs a text layer, so a scanned image will be rejected.
4. Open a Workday posting and click **Read this posting**. Edit the fields if the scrape got something wrong.
5. Click **Tailor CV and write letter**. This takes 30 to 90 seconds. Read the rounds, the letter, the CV, the changes and the gaps.
6. Click **Apply** on the posting yourself and sign in. On each form page, click **Fill this page**, check the fields, then click Workday's own Save and Continue.

## The anti-slop loop

Most "humanise my AI text" tools guess whether text sounds like a model and give you a score. jobie-agent does not guess. It has a list of named patterns, each with a regex and a fix, and it reports every match with the sentence it came from. Zero matches is the only pass.

The rule families in `agent/slop_rules.py`:

| Rule | What it catches |
|---|---|
| banned word | delve, leverage, robust, seamless, tapestry, testament, spearhead and about 35 more |
| cover letter cliche | "I am writing to express", "excited to apply", "proven track record", "team player", "perfect fit" |
| empty phrase | filler that adds no fact |
| binary contrast | "not just X but Y" |
| throat clearing | openers that announce the sentence instead of saying it |
| faux insight | "the key is", "what matters is" |
| colon reveal | "The result: everything changed." (letters only) |
| superficial analysis | claims of depth with no specifics |
| importance puffery | "plays a vital role", "is essential to" |
| metadiscourse | text about the text |
| weasel attribution | "experts agree", "studies show" |
| negative listing | "no fluff, no filler, no nonsense" |
| dramatic fragmentation | one-word sentences for effect |
| rhetorical setup | "Why? Because" |
| hedging stack | "may potentially", "could possibly" |
| emoji | any |

On top of the regex rules, `agent/slop.py` checks the shape of the text: em dashes (one is enough to fail a letter), letters over 350 words, a closing paragraph that summarises, most sentences opening with "I", and sentence lengths so even they read as machine output.

The checker runs in two layers:

1. **Inside the agent.** `slop_check` is a Strands `@tool`. The system prompt tells the model to call it on the letter and on the CV before it answers, and to fix and re-check until both return zero findings.
2. **Outside the agent.** `agent/writer.py` runs the same `check()` on the structured output the model returned. If anything remains, it sends the findings back as a rewrite prompt. Up to three rounds. The panel shows each round and its findings so you can see the draft getting cleaner.

The model also gets a plain brief: facts from the CV only, list what the posting asks for that the CV does not show as a gap, 180 to 300 words for the letter, open with a specific fact and never with "I am writing to".

### A real run

<!-- SMOKE_TRANSCRIPT: replaced by scripts/smoke.py output after the first real run -->
Transcript pending the first real run. `python scripts/smoke.py bedrock` from the repo root prints one.

## Bring your own key

| Provider | Panel value | Env var fallback | Default model | Strands class |
|---|---|---|---|---|
| Amazon Bedrock | `bedrock` | `AWS_BEARER_TOKEN_BEDROCK`, or the usual boto3 credential chain | `global.anthropic.claude-sonnet-4-6` | `BedrockModel` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-5` | `AnthropicModel` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4o` | `OpenAIModel` |

A key typed in the panel wins over `.env`. The Bedrock region comes from the panel, then `AWS_REGION`, then `us-east-1`. The model id box in the panel overrides the default.

Keys travel from the panel to the local server on 127.0.0.1 and go straight into the Strands model object for that request. The server writes no keys to disk. The extension stores what you type in `chrome.storage.local`, which is plaintext on your own machine. See Limitations.

## It never presses Submit

The content script in `extension/content/workday.js` sets input values, picks dropdown options and attaches files. It has no code path that clicks Save and Continue, Next or Submit. Every page advance is your click. The panel says so under Apply, and the tests in `tests/test_fake_page.py` drive the fill against a fake Workday page to check that nothing else moves.

## Built with Strands Agents

- `strands.Agent` with a system prompt and one tool, built once per request with the user's model.
- `@tool slop_check` from `agent/writer.py`, so the model can check its own draft mid-turn.
- Structured output: each call passes `structured_output_model=TailorResult`, a Pydantic model with the CV markdown, the letter, the changes and the gaps. Tools and structured output work in the same invocation.
- Three model providers from `strands.models`: `BedrockModel` with a Bedrock API key as bearer token, `AnthropicModel` and `OpenAIModel`, picked per request from the panel.

The Python side is FastAPI on `127.0.0.1:8765` with four endpoints: `GET /health`, `POST /cv/parse`, `POST /tailor` and `GET /files/{name}`. PDFs are rendered with reportlab from a small markdown subset. CV text comes out of the PDF with pypdf.

## Limitations

- Workday selectors have been verified against the bundled fake page in `extension/test/fake-workday.html` and, for the posting page only, one real tenant (edftrading.wd1). Application form selectors come from open-source fillers and are not yet checked on a live tenant. Real Workday tenants vary. Fields the script cannot find are listed under Skipped after a fill and you type them by hand.
- No account creation and no sign-in. Workday's apply flow needs an account on each employer's tenant, and that step stays manual on purpose.
- The API key and profile live in `chrome.storage.local` as plaintext. Anyone with access to your Chrome profile can read them. Use a key you can revoke.
- The CV PDF needs a text layer. Scans and image-only PDFs are rejected with a clear error.
- The checker is deterministic, so it catches only what it has a rule for. It will not catch a made-up fact. Read the letter before you send it. The gaps list is there to help.
- One posting at a time. There is no queue and no history.

## Tests

```
.venv\Scripts\python.exe -m pytest tests -q
```

The suite covers the checker rules, PDF round trips, the writer loop with a fake model, the provider builder, the server with the agent mocked, and the content scripts driven through installed Chrome with Playwright.

## License

MIT. See `LICENSE`.
