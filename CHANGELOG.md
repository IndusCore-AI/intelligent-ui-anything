# Changelog

## 0.2.0 (2026-10-26)

The pages now look like an answer inside a chat, not a report.

- One new locked theme in the visual language of ChatGPT's inline answers (after OpenAI's MIT-licensed Apps SDK UI tokens): neutral surfaces with a 0.005 chroma floor, white cards with hairline edges and soft shadows, pill controls, tinted meaning badges with a dot, an outlined icon sprite, and fewer type sizes. Floor 12/12 and Hallmark lint 0 FAIL, 0 REFLEX, 0 WARN on every template.
- compare: a leaders strip (the best value of up to three `better` columns and who holds it), the table in a card with a radio column, whole rows tappable, best values as green check pills. On a phone each row becomes a small card with a two-column grid, and the column heads become a swipeable row of sort chips.
- choose: whole cards tappable, the selected card ringed, facts as stats, pros and cons with icons, the recommendation as a badge with its reason under the summary.
- track: a large progress figure, a status icon per step, the running step tinted.
- inspect: an overview of lane counts, each lane a card with its count, severity as tinted pills, decisions as pill choices.
- explain: the contents and the document in cards, changed sections marked with a bar in their meaning's colour.
- The decision dock floats, sits as one quiet line until the first pick, opens with a short settle, and says Copied or Sent on the button itself.
- Motion: cards rise and bars grow as if streamed (420 ms, ease-out), off for reduced motion and on live track pages so reloads do not flicker. Content is in the HTML and visible without script; a one-line head script adds the `js` class before first paint.
- The description now leads with when an answer should be a page and says to use it instead of writing HTML by hand. Measured in a real `claude -p` setup with MCP servers and global rules: 6 of 7 should-trigger prompts and 0 of 4 should-not.
- New compare options: `columns[].best_label`, `highlights: false`.

## 0.1.1 (2026-10-26)

Acceptance pass on a second machine, and the move to the IndusCore-AI organisation.

- Repo, plugin manifest and README point at `IndusCore-AI/intelligent-ui-anything`.
- README rewritten: hero image of a real request and its page (`docs/hero.png`, source in `docs/src/`), quick start, example gallery, the five shapes, how it works, install per agent.
- A served page leads with Send to the agent; Copy stays beside it as the fallback.
- Pick buttons on rows and option cards give the same instant press feedback as every other button, with the reduced-motion fallback.
- `render --help` printed a line of its own source; it now prints the usage comment only, and lists `--serve`.
- `SKILL.md` describes the two founding cases in general words instead of by founder name.
- Verified on a second Mac (Claude Code 2.1.310, Node 26): a plain `claude -p` request with no skill named triggered the skill and opened a checked page in 47 s; `render --serve --wait` returned `decision: Use model Z-Image-Turbo` after a real click on Send in Chromium; the Artifact target was published to claude.ai.

## 0.1.0 (2026-10-25)

First version, private, for testing.

- Five shapes, each a locked template: compare (sortable table, optional bar chart, optional pick), choose (option cards, one pick), explain (contents, anchors, what changed), track (a checklist that reloads itself while live), inspect (lanes, filters, diffs, decisions).
- `scripts/render`: JSON in, one self-contained page out, checked, then opened in the browser, served on localhost (over SSH, or to get the pick back), written for an Artifact tool, or printed as a path. Line-oriented output an agent can read.
- `scripts/serve`: loopback server that returns the user's pick to the agent and stops when idle.
- `scripts/check`: ten floor rules, two security rules, and Hallmark's sloplint (vendored from commit 7ec8682) at app scope.
- Semantic layer: five elements, severity, status, diff and finance colours by locale, measured for contrast and colour-blind separation in light and dark.
- Host detection measured in Claude Code 2.1.310, Codex CLI 0.164 and Linux (Docker); Windows, Cursor and Antigravity written, not yet run.
- Examples with real data: ComfyUI checkpoints, the five element planets, a review of three real sessions.
- Install by `npx skills add`, as a Claude Code plugin, or by cloning into an agent's skills folder.
