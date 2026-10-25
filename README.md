# Intelligent UI Anything

Turn what your agent just produced into one small page you can sort, read or pick from, opened where you already are, and get your pick back into the session without retyping it.

**A sortable model list where one click hands the agent "Use model FLUX.2 [klein] 4B".**
![Ten ComfyUI checkpoints compared on GenEval, weight size, steps and licence, with one row picked and the line for the agent ready to copy](examples/comfyui-models.png)

**One page after several sessions: what changed, what is risky, and the open items decided on the page.**
![A review of three sessions with the open items decided and one reply built for the agent](examples/post-session-review.png)

**Colour that means something: each planet wears its element, in light and dark.**
![The five element planets charted by orbital period, each bar in its element's colour, dark theme](examples/five-elements.png)

## Install

Any agent that reads Agent Skills (Claude Code, Codex, Cursor and others):

```bash
npx skills add gaurpulkit/intelligent-ui-anything
```

| Agent | Install |
| --- | --- |
| Claude Code, as a plugin | `/plugin marketplace add gaurpulkit/intelligent-ui-anything`, then `/plugin install intelligent-ui-anything@intelligent-ui-anything` |
| Codex CLI | `git clone https://github.com/gaurpulkit/intelligent-ui-anything .agents/skills/intelligent-ui-anything` (or into `~/.agents/skills/`) |
| Cursor | `git clone https://github.com/gaurpulkit/intelligent-ui-anything .cursor/skills/intelligent-ui-anything` |
| claude.ai | zip the repo folder (named `intelligent-ui-anything`) and upload it under Skills, with code execution on |

It needs Node.js 18 or later and nothing else: no packages, no network. Then ask the way you would ask a person: "compare these models and let me pick one", "lay out the three options", "show me what changed, what's risky and what's undecided across today's sessions".

What happens: the agent picks one of five shapes (compare, choose, explain, track, inspect), writes the content as JSON, and `scripts/render` fills a locked template, checks it against ten design and honesty rules plus the [Hallmark](https://github.com/Nutlope/hallmark) lint, and opens it. With Claude Code's Artifact tool it becomes an artifact; in a terminal it opens in your browser; over SSH it is served on localhost with the tunnel command printed; inside Codex's sandbox it prints the path. Your pick comes back by a Copy button, or straight into the session when the page is served.

## What it does not do

- No panel inside VS Code yet. Pages open in the browser.
- No inline rendering inside ChatGPT or Perplexity. The Codex app has its own inline surface; this skill writes a page file there instead.
- It does not build or edit your app's UI. It makes throwaway pages that answer one question.
- Windows, Cursor and Antigravity paths are written but not yet run; [references/hosts.md](references/hosts.md) says what was measured where.

What a page costs, measured on 2026-10-25 as the output tokens Claude Opus 5.5 spends writing it (tool overhead subtracted):

| Content | Same content as plain text | As a page with this skill (the agent writes JSON) | As a hand-written HTML page |
| --- | --- | --- | --- |
| Review of three sessions, 20 items | 1,223 | 2,262 | 4,450 |
| ComfyUI comparison, 10 rows | 802 | 1,293 | not measured |

The template, styles and script are never written by the model, so a page costs less than twice the plain answer and about half a page written by hand, and it passes the same checks every time. Loading the skill adds about 3,500 input tokens (SKILL.md, measured the same way), once per session.

[![validate](https://github.com/gaurpulkit/intelligent-ui-anything/actions/workflows/validate.yml/badge.svg)](https://github.com/gaurpulkit/intelligent-ui-anything/actions/workflows/validate.yml)
![Agent Skills spec](https://img.shields.io/badge/Agent%20Skills-spec%20valid-1f9971)
![Dependencies](https://img.shields.io/badge/dependencies-0-1f9971)
![Node](https://img.shields.io/badge/node-%3E%3D18-555)
![License: MIT](https://img.shields.io/badge/license-MIT-0f74c5)

## Licence

MIT, copyright IndusCore. `scripts/vendor/hallmark/` is Hallmark's sloplint, MIT, copied unchanged from a named commit.

Not affiliated with OpenAI.

Built by IndusCore, [induscore.site](https://induscore.site).
