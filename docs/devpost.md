# Devpost submission text

Track: **Pro Agents**

Project name: **jobie-agent**

Tagline: Reads a Workday posting, rewrites your CV and cover letter without AI tells, fills the form, and stops before Submit.

## Inspiration

Workday runs the application form for more than 11,500 organisations, including over 65% of the Fortune 500 ([Workday, Feb 2026](https://newsroom.workday.com/2026-02-24-Workday-Announces-Fiscal-2026-Fourth-Quarter-and-Full-Year-Financial-Results)). Each application is twenty minutes of retyping a CV into boxes. So people paste the posting into a chatbot, paste the answer into the form, and hit Submit. Hiring managers have caught on. In a 2026 TopResume survey of 800 hiring managers, 67% said they can spot an AI-written cover letter and 54% view one negatively ([TopResume](https://topresume.com/career-advice/ai-in-hiring-survey)).

The tools that promise to fix this either guess with a "humanness" score or send your CV to someone else's server. I wanted the opposite: named rules you can read, a key you own, and an agent that does the typing but leaves the Submit button alone.

## What it does

jobie-agent is a Chrome extension plus a local Strands agent.

1. Open a posting on any myworkdayjobs.com site. The side panel reads it.
2. Click Tailor. The agent rewrites your CV for that role and writes a cover letter using only facts from your CV. Requirements your CV does not show go into a gaps list instead of being invented.
3. A deterministic checker scans both drafts for named AI-writing patterns: banned words, cover letter cliches, "not just X but Y", colon reveals, hedging stacks, em dashes, robotic sentence rhythm, clauses that tell the reader why a fact matters, more than one number per sentence, a number the CV never gave, and more. Every finding names the rule and quotes the sentence. Zero findings is the only pass. The panel shows one line when the agent is done, and the server logs every check: the ones the model ran on its own draft mid-turn and the outside pass.
4. Click Apply on the posting yourself and sign in. Then click Run to review. It fills each page, picks the dropdowns, attaches the PDFs, presses Save and Continue, and logs what it could not find. Profile and CV are saved once, so each later application is Read, Run, Review.
5. It stops on the Review page, on a validation error, or on a page it does not recognise. Workday's Submit button shares an id with Save and Continue, so the extension reads the button text before every click and refuses anything that says Submit. You read the review page and submit it yourself.

Bring your own key: Amazon Bedrock, Anthropic or OpenAI, picked in the panel. Nothing runs anywhere but your machine and your chosen model provider.

## How it is built

- **Strands Agents SDK.** One `strands.Agent` per request with a system prompt and one tool. `slop_check` is a `@tool` the model calls on its own draft before answering. Each call returns structured output through a Pydantic model (CV markdown, letter, changes, gaps). Tools and structured output work in the same invocation.
- **The rewrite loop.** The same checker runs again in Python on the structured output. If findings remain it sends them back as a rewrite prompt, up to two rounds, and records each round for the UI alongside the model's own mid-turn `slop_check` calls, read back from the Strands message history.
- **Model providers.** `BedrockModel` with a Bedrock API key as bearer token, `AnthropicModel` and `OpenAIModel`, built per request from what the user typed in the panel or from `.env`.
- **Server.** FastAPI on 127.0.0.1:8765. Four endpoints: health, CV parse (pypdf), tailor, and file download. PDFs rendered with reportlab.
- **Extension.** Manifest V3, no build step. Side panel UI, a service worker that owns all HTTP, and content scripts for Workday. React-controlled inputs need the native value setter plus input and change events, and file inputs take a DataTransfer with a React onDrop fallback.
- **Tests.** pytest across the checker, PDF round trip, writer loop with a fake model, provider builder, the server with the agent mocked, and the content scripts driven through installed Chrome with Playwright against a bundled fake Workday page.

## Challenges

- Workday posting pages have no public selector reference and no open-source tool scrapes them, so every posting selector has a fallback and the panel fields stay editable.
- Chrome content scripts obey the page's CORS since Chrome 85, so every request to the local server goes through the service worker.
- Making "no AI slop" testable. A score you cannot explain is useless as a loop condition. Named regex rules plus a few shape checks gave a pass condition the model can hit and a person can audit.
- One-day build behind a corporate proxy that blocks browser downloads. Playwright drives the installed Chrome instead.

## What is next

- Verify selectors across more Workday tenants and add Greenhouse and Lever.
- A questions page filler that answers from the CV and refuses to guess.
- Encrypt the stored key with a passphrase instead of plaintext `chrome.storage.local`.
- A history of applications with the gaps list, so you can see which skills keep coming up.

## Links

- Repo: https://github.com/kitfunso/jobie-agent
- Video: (unlisted YouTube link)
- Built with: Strands Agents SDK, Amazon Bedrock, FastAPI, Chrome Manifest V3, Playwright, pypdf, reportlab
