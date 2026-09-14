# Design System - jobie-agent

## Product Context
- **What this is:** a 320px Chrome side panel that reads a Workday posting, tailors a CV and cover letter through a local Strands agent, fills the application and stops before Submit.
- **Who it's for:** job applicants with their own model key, working beside a Workday tab.
- **Space/industry:** job applications, recruiting software.
- **Project type:** app UI (side panel, form-dense, task-focused).

## Aesthetic Direction
- **Direction:** typed dossier with a paper-shader header. A job application is paperwork; the panel reads like a well-set form, and the one generated surface is the header band, where a Paper Shaders field (mesh gradient, neuro noise, dot orbit, dithering or grain) breathes slowly and quickens while the agent runs.
- **Decoration level:** minimal below the header. Hairlines and type carry the hierarchy; no cards, no icons in circles, no gradients outside the shader.
- **Mood:** calm, exact, clearly not part of Workday.
- **Memorable thing:** it reads like a receipt of what the agent did and what it refused to do: every check the model ran is a row you can open, and the button it will never press is named on screen.

## Typography
- **Display/Hero:** Instrument Sans - one humanist grotesque at 600 for headings and the header wordmark, so the panel has one voice.
- **Body:** Instrument Sans - 400 for labels and running text, 13px base in the panel, 16px in mock pages.
- **Data/Tables:** IBM Plex Mono - rule names, round tallies, model ids, file names and run-log lines, with tabular-nums.
- **Code:** IBM Plex Mono.
- **Loading:** https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap for mocks; the shipped extension bundles the woff2 files locally so the panel makes no font request.
- **Scale:** 1.25 ratio: 11, 13, 16, 20, 25px. Line height 1.5 body, 1.2 headings.

## Color
- **Approach:** restrained. Cool neutrals, one deep green accent, amber and red only as semantics. No purple, violet or indigo anywhere, including inside the shader.
- **Primary:** #1F5C3A - the one primary button per stage, filled-row marks, focus rings, the shader's darkest colour.
- **Secondary:** #5B6168 - muted text, secondary buttons, hairline labels.
- **Neutrals:** #F5F6F3 #FFFFFF #D8DCD5 #5B6168 #16191C (cool, never warm).
- **Semantic:** success #1F5C3A, warning #8A5A00 (skipped, gaps), error #A32D2D (errors, Stop), info #5B6168.
- **Shader colours:** #F5F6F3, #D8DCD5, #9FC7AD, #1F5C3A in light mode; #121416, #1B1E21, #2E5C42, #6FBF8E in dark mode.
- **Dark mode:** ground #121416, surface #1B1E21, ink #E8EAE6, accent #6FBF8E (desaturated green), hairline #2A2E31. Elevation by lighter surfaces, not inversion.

## Spacing
- **Base unit:** 4px
- **Density:** compact
- **Scale:** 2xs(2) xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32)

## Layout
- **Approach:** one column, three numbered stages in the order of work: 1 Set up once (settings, profile, CV), 2 This posting (read, tailor, checks), 3 Apply (run to review, log). Stage 1 folds away after the first save.
- **Grid:** single column, 320px panel, 12px side padding, labels above inputs.
- **Max content width:** 320px (the panel); mock pages show the panel docked at the right edge of a neutral placeholder tab.
- **Border radius:** 2px inputs, 3px buttons, 0 on the header band and rules.

## Motion
- **Approach:** minimal-functional. The shader runs slowly at rest (speed 0.25), faster during a run (0.8), and still on the Review stop. Status banner and run-log rows enter with a 150ms fade and 4px rise. Hover changes colour only. prefers-reduced-motion freezes the shader on one frame and removes the entrances.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out
- **Duration:** micro 50-100, short 150-250, medium 250-400 ms

## Decisions Log
| Date | Decision | Rationale |
|---|---|---|
| 2026-09-14 | Paper shader header, flat editorial below | User picked "paper shaders and procedural heroes"; one GPU surface in a 320px panel, the rest stays a form. Three.js heroes left out because bundling three.js into an MV3 extension is heavy and Paper Shaders is zero-dependency. |
| 2026-09-14 | No purple | User instruction. |
| 2026-09-14 | Deep green accent on cool neutrals | Workday is blue; green keeps the panel visibly separate. Deep rather than acid so it is not the dev-tool cliche. |
| 2026-09-14 | Fonts bundled in the extension | The product promise is that nothing leaves the machine except the model call. |
