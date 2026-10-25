# Changelog

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
