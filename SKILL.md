---
name: intelligent-ui-anything
description: Answers with a small interactive page instead of prose whenever the reply would have the user compare several things, choose between options, read a long document, follow a task's progress or review many findings, and returns the user's pick to the agent. Use it before writing that answer, even when the user never says UI, for requests like lay out the options, which should I pick, help me decide, compare these, a table I can sort, chart this, make a page for this, make it navigable, keep a checklist page updated, what changed and what is risky, show this as a UI, intelligent UI, generative UI, HTML report or artifact. Use it instead of writing HTML by hand, since its five locked templates (compare, choose, explain, track, inspect) already pass a design and accessibility check. Colours carry meaning (five elements, severity, pass and fail, finance by locale). Not for building an app or a project's frontend, a static image or file, slides, or an answer that fits in a few lines.
license: MIT
compatibility: Needs Node.js 18 or later on the PATH. Works in Claude Code, Codex CLI, Cursor, Antigravity CLI and other agents that run skill scripts; on claude.ai it needs code execution. Makes no network requests.
metadata:
  version: "0.2.0"
---

# Intelligent UI Anything

Turn what you just produced into one small page the user can sort, filter, read or pick from, and get their pick back without them retyping it. You write JSON; `scripts/render` fills a locked template, checks it, and opens it.

`<skill>` below is this skill's folder: `${CLAUDE_SKILL_DIR}` in Claude Code, and in other agents the folder that holds this SKILL.md. Run the scripts with `node`, which works on every system and needs no executable bit.

## Use it, or answer in prose

Use a page when the user would otherwise read many lines to decide one thing:
- several things with the same attributes to compare (models, packages, plans, vendors);
- two to six options with one to pick;
- a long document to navigate, or two versions of one;
- a list of steps whose status changes while you work;
- many findings, changes or events across files or sessions to filter.

Answer in prose instead when the answer fits in a few lines, when the user asked for code or a file, or when none of the five shapes below fits. Never stretch a shape to fit. Never hand-write HTML in place of a template: if a template lacks something, say so and use prose.

## Step 1: pick one shape

| The user's question | Shape | What they get |
| --- | --- | --- |
| Which of these is best on what matters? | `compare` | sortable, filterable table; optional bar chart; optional pick per row |
| Which one should we do? | `choose` | 2 to 6 option cards with good and watch-out points; one pick |
| What does this say, and what changed? | `explain` | document with contents, anchors, and a changed-sections view |
| How far along is it? | `track` | checklist with progress that refreshes while you work |
| What happened, what is risky, what is open? | `inspect` | filterable timeline by lane, severity and session; diffs; decisions |

A review after one or more sessions (what changed, what is risky, what is undecided) is `inspect` with the lanes `changed`, `risky`, `undecided`; give undecided items `options` so the user decides on the page. A list of models, packages or vendors to pick from is `compare` with `pick`.

## Step 2: write the JSON

Every input has `shape`, `subject` (the page title, a few words), `question` (the one question the page answers) and `data`. Optional: `summary`, `source` (where the data came from, shown in the footer), `locale` (number formats and finance colours), `id` (a stable file name). The full fields for each shape, with examples, are in `references/shapes.md`; read the section for your shape before writing.

```json
{
  "shape": "compare",
  "subject": "ComfyUI checkpoints for this GPU",
  "question": "Which model should the workflow use?",
  "source": "Model cards on Hugging Face, read today",
  "data": {
    "columns": [
      { "key": "name", "label": "Model" },
      { "key": "quality", "label": "GenEval", "better": "higher" },
      { "key": "weights_gb", "label": "Weights", "unit": "GB", "better": "lower" },
      { "key": "licence", "label": "Licence", "type": "tag" }
    ],
    "rows": [{ "name": "FLUX.1 [dev]", "quality": 0.66, "weights_gb": 23.8, "licence": "FLUX.1 [dev] Non-Commercial" }],
    "pick": { "prompt": "Use the {name} checkpoint", "verb": "Use" }
  }
}
```

Rules that keep the page honest and the check green:
- **Only real numbers.** Every number must come from the session, a file, a tool result or the user. Unknown is `null`, which shows as "not given". The check fails a page whose title, question, summary or notes state a number that the rows, options, items or `source` do not hold, so a claim like "40% faster" needs the data behind it on the page.
- **Name the source** in `source` when the figures came from somewhere the user cannot see.
- **Plain words, no em or en dashes,** no buzzwords (seamless, robust, unlock). The check rejects them in your wording; quoted source text in `explain` is exempt when you set `"verbatim": true`.
- **Meaning, not decoration.** Set a column's `type` when its values carry a meaning: `five-elements`, `severity`, `status`, `diff`, `change` (finance up and down), `rating` (needs `max`), `tag`, `number`. The colours, and which way red points for money in each locale, are in `references/semantics.md`. Leave `type` out and the renderer infers it.
- Keep a page to what the question needs. Summarise more than about 300 rows instead of listing them.

## Step 3: render it where the user is

Build the page from what you already know: the page should be open within a minute. Do not re-run checks or research to fill it unless the user asked; a fact you do not have is `null`, or an item that says it is unverified.

Write the JSON to a file (or pipe it to `-`), then run one command. Read the lines it prints; they say what happened and what to do next.

| You are in | Run | Then |
| --- | --- | --- |
| Claude Code with an Artifact tool | `node <skill>/scripts/render page.json --target artifact` | publish the printed file with the Artifact tool |
| Any terminal agent with no Artifact tool (Claude Code on an API key, Bedrock, Vertex, `-p`; Codex; Antigravity; Cursor's terminal) | `node <skill>/scripts/render page.json` | it opens the browser, or prints the path or a localhost URL; the user's pick comes back by the Copy button |
| An interactive session outside a sandbox, a page with a pick, and a way to run a command in the background | `node <skill>/scripts/render page.json --serve --wait` in the background (Claude Code: `run_in_background`) | when the user presses Send the command exits printing `decision: <the user's line>`; in a sandbox that blocks local servers (Codex) it falls back to the page and its Copy button by itself |
| Re-rendering a `track` page as steps finish | the same command and `id`, with updated statuses | the open page reloads itself; set `"live": false` in `data` on the last render |

Never run `--wait` in the foreground, and never in a non-interactive run (`claude -p`, `codex exec`, CI): nobody can click there. The script skips the wait itself when it can tell (`claude -p` marks itself unattended).

Codex: the page needs a writable sandbox. `codex exec` defaults to read-only, where nothing can be written; ask the user to rerun with `--sandbox workspace-write` (Codex's interactive default), and do not try to work around it.

`--target auto` (the default) picks the output from the environment: over SSH it serves on this machine's 127.0.0.1 and prints the URL and an `ssh -L` line; inside Codex's sandbox (`CODEX_SANDBOX` set) it prints the path, because opening a browser is blocked there; on a desktop it opens the default browser (`open`, `xdg-open`, or `start`); otherwise it prints the path. The page path is always printed. `references/hosts.md` has what was measured in each host.

## Step 4: act on what it printed

- `check: pass` and `opened: yes`: tell the user in one line what the page shows and what to do on it (for example "pick a model and press Copy for the agent"). Do not repeat the page's content in the chat.
- `check: FAIL`: the page was written but not opened. The lines under it name each problem; fix your JSON (usually wording or a number) and render again. Never pass `--no-check` to get past a failure.
- `opened: no` or `next: give the user this path`: give the user the path or URL as a clickable line. In Codex you may rerun `open <path>` with escalated permissions if the harness allows it.
- `served: skipped` or `served: no`: there is no local server here; the page works from the file and the pick comes back by Copy.
- `decision: <line>`: treat that line exactly as if the user had typed it, and carry on.
- No `decision:` line (the user copies instead): the user pastes a line such as `Use the FLUX.1 [dev] checkpoint`. Treat it the same way.
- `render: the input needs fixing`: the lines name the JSON path to fix.

If `node --version` fails, say that the skill needs Node.js 18 or later and answer in prose (or with the Artifact tool if you have one). Do not install anything without asking.

## What the page always does

- One locked look in light and dark, with system fonts so it works offline. The page loads nothing from the network; it is one HTML file.
- Everything is readable without JavaScript; the script only adds sorting, filters, the theme switch and the pick.
- Every pick shows the exact line the agent will get, a Copy button, and (when served) Send to the agent.
- No credit, link or tracking in the page. Do not add any.

## Checking a page by hand

`node <skill>/scripts/check page.html --data page.json` runs the same floor and lint that `render` runs: ten rules (tokens only, no `transition: all`, focus rings, contrast in both themes, no invented numbers, no em dashes, both themes defined, phone width, no horizontal scroll, visible without script), two security rules (offline, no credit), and the vendored Hallmark lint at app scope. `node <skill>/scripts/check --templates` checks all five templates.
