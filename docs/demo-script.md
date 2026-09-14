# Demo video shot list

Target length: 4 minutes. Hard cap: 5 minutes. Record with Win+G or Loom at 1080p. Side panel open on the right, browser on the left. Server already running in a terminal you can alt-tab to.

Before recording: server running, key in `.env`, CV uploaded, profile saved, a real Workday posting open, and an account on that tenant already created and signed in.

## 0:00 to 0:20. The problem

Screen: the Workday posting.

Say: "This is a Workday posting. Workday runs hiring for most large employers. Each application is twenty minutes of form filling, and if your cover letter reads like a model wrote it, most hiring managers say they can tell and mark you down. jobie-agent fixes both, on your machine, with your own key."

## 0:20 to 0:50. Read the posting

Action: click the extension icon, panel opens. Click **Read this posting**.

Show: title, company, location and description fill in.

Say: "The side panel reads the posting. Nothing leaves the machine yet."

## 0:50 to 1:50. Tailor

Action: click **Tailor CV and write letter**. While it runs, alt-tab to the terminal so the request log shows.

Show: the finish line appears, "Finished. 1 self-check, final pass clean." Alt-tab to the terminal, where the server logs one line per check with the rule names, and read two of the rules the model caught on itself.

Say: "The agent writes the CV and the letter from the facts in my CV. Its one tool is a deterministic checker that scans a draft for named AI writing patterns. Here the model ran it on its own draft and it caught a banned word and an em dash. It fixed them and checked again before it answered. Then the same checker ran outside the agent and found nothing. No guessing, no score, just named rules and a zero."

Show: scroll the letter. Read the first sentence aloud. Scroll to Changes and Gaps.

Say: "Gaps are things the posting asks for that my CV does not show. The agent lists them instead of inventing them."

## 1:50 to 2:50. Fill the form

Action: click **Apply** on the posting, then **Apply Manually**. On My Information, click **Run to review**.

Show: name, email, phone, country dropdown filling, then the page advancing on its own. The run log in the panel adds a line per page: filled, pressed Save and Continue, next page.

Say: "One click. It fills each page, presses Save and Continue, and tells me what it could not find. Profile and CV were saved once, so every application after this is Read, Run, Review."

Show: My Experience with the CV PDF attached and the letter in the text box or attached.

## 2:50 to 3:10. It stops here

Show: the run stops on the Review page. The panel says "Review page. Read it through and press Submit yourself."

Say: "The Submit button sits under the same Workday id as Save and Continue. The extension reads the label before it clicks and refuses anything that says Submit. I read the whole thing and submit it myself."

## 3:10 to 4:00. How it is built

Screen: `docs/architecture.png`, then `agent/writer.py` in the editor.

Say: "The agent is a Strands Agent with one tool. slop_check is a Strands tool the model calls on its own draft before it answers. Every call returns structured output through a Pydantic model. The same checker runs again outside the agent, and if anything is left it sends a rewrite prompt, up to two rounds. Bring your own key: Bedrock, Anthropic or OpenAI, picked in the panel and built into the Strands model per request. The server is FastAPI on localhost. The extension is plain Manifest V3, no build step."

Screen: README with the real run transcript.

Say: "Repo link and a real run transcript are in the README. Thanks."

## Cut list if over time

Drop the terminal alt-tab at 0:50. Drop the My Experience page and say "same on the next page". Keep the zero-findings round and the Review page, those are the two claims.
