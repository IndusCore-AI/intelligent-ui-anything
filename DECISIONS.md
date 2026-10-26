# Decisions

Where this build differs from the brief, or settles something the brief left open, and the evidence. Dates are 2026-10-25 unless stated.

## Runtime and layout

**One runtime: Node built-ins, no Python.** The brief allowed Python's standard library or Node's built-ins. The floor needs the vendored Hallmark lint, which is Node (4,422 lines, no port), so a Python `render` would have needed Node anyway and spawned it through `subprocess`, which the skill-radar installer scan flags. With Node everywhere there is one prerequisite and the scan stays clean. Cost: a user with Python and no Node (a ComfyUI-only machine, say) cannot run it; `SKILL.md` tells the agent to say so and answer in prose. Claude Code's native installer does not bring Node, so this is a real limit, not a theoretical one.

**The repo root is the skill.** `SKILL.md` sits at the root and `.claude-plugin/` holds a plugin and a one-entry marketplace pointing at `./`. One layout serves every install path, each tested: `npx skills add` found and installed it (skills 1.7.4), `claude plugin install` installed it from a local marketplace into an isolated config, `skills-ref validate` passes on the folder, and a plain clone into `.agents/skills/` worked in Codex. The spec requires the folder name to match `name`, so clones must keep the name `intelligent-ui-anything`.

**Scripts have no extension and are run with `node`.** `node scripts/render` works on macOS, Linux and Windows without an executable bit or a shebang.

## Where the page goes

**The agent decides "artifact"; the script decides the rest.** A script cannot see the agent's tool list, so `SKILL.md` tells an agent that has an Artifact tool to pass `--target artifact`. Everything else is `--target auto`, read from the environment (`references/hosts.md`).

**Artifact output is a fragment.** The Artifact tool wraps every file in its own document, so `--target artifact` writes the same page without `<html>`, `<head>` and `<body>`, moves `lang` and the finance convention onto the page wrapper, and drops the page's own theme switch (the viewer has one). Published and read back once: the service wrapped it as expected. Not seen rendered in the viewer: no signed-in browser was available to automation.

**Codex gets the path, not the browser or a server.** Measured in Codex CLI 0.164.0-alpha.11.1: inside the seatbelt sandbox `open` fails (`kLSExecutableIncorrectFormat`, exit 1) and listening on 127.0.0.1 fails (`EPERM`). `codex exec` defaults to a read-only profile where no file can be written at all; Codex itself said so and stopped. So in Codex the skill writes the page and prints the path, and `SKILL.md` tells the agent to ask for `--sandbox workspace-write` rather than work around a read-only sandbox.

**Cursor's canvas is not a target in v1.** The brief named it. Cursor's `/canvas` renders React components the agent writes, which would bypass the templates and the floor; Cursor is not installed here, so nothing about it could be measured. Cursor gets the browser path like any terminal.

**Found, not used: the Codex app's inline surface.** Codex ships a bundled `visualize` skill: an HTML fragment written to a task-owned folder plus a `visualize{"path": ...}` line renders inline in the ChatGPT/Codex app. It also wins plain "make me a chart" prompts there; named explicitly, this skill rendered the same chart in 18 seconds. An inline target is the most valuable next step, but it was not built because the desktop app could not be driven from here to verify it.

## The decision return

**Copy is the path that always works; Send is optional.** Every pick shows the exact line the agent will get and a Copy button that uses `navigator.clipboard.writeText` inside the click handler and selects the line when the browser refuses. The artifact contract documents exactly this pattern. Send needs `render --serve --wait` (or `scripts/serve`), which binds 127.0.0.1 under a random path, refuses wrong `Host` (421), cross-origin posts (403), non-JSON (415) and bodies over 32 KB (413), writes the pick to a file, prints `decision: <line>`, and stops when idle. All six refusals and the round trip are in `tests/cli.test.js`.

**The script refuses to wait where nobody can click.** The first acceptance run blocked on `--serve --wait` inside `claude -p` until it was killed. Measured: `claude -p` sets `CLAUDE_CODE_SESSION_ATTENDED=0` and `CLAUDE_CODE_ENTRYPOINT=sdk-cli` (an interactive session has `1` and `cli`), so `render` now skips the wait there, and skips serving in the Codex sandbox, and falls back to the page and Copy when a server cannot start.

**`compare` can carry a pick.** The brief's first moment is a sortable matrix whose pick returns "Use model X", so `compare` takes an optional `pick`; `choose` stays for two to six options with prose trade-offs.

**The post-session review is `inspect`, not a sixth shape.** Lanes `changed`, `risky`, `undecided`; undecided items carry options, and every pick joins one reply.

## The floor

**Stricter than asked.** A page passes with all ten floor rules, two security rules (nothing loads from the network; no credit or tracking) and the vendored lint at app scope with no FAIL and no REFLEX, warnings shown. Every gate counts except Hallmark's gate 20, its CSS stamp: a hidden comment naming Hallmark, which would be hidden credit in a generated page.

**"No invented numbers" checks prose against data.** The first version compared page numbers with the whole input and so could not catch a number the agent wrote into its own summary (a planted "40 percent faster" passed). Now the title, question, summary, notes and chart captions may only state numbers that the rows, options, items, sections or `source` hold; numbers glued to letters (fp16, v2, 4B) are names. Counts the page computes are marked as derived. This caught a real error: the explain fixture said "since version 1" with no version 1 in the data.

**"No credit" reads the input.** A real review of this repo names the repo and the company; the first rule blocked it and the agent reworded the page to get past it. Now the page fails only when it names the tool or its maker more often than the input does.

**Quoted text keeps its own characters.** `explain` with `"verbatim": true` exempts the document's own words from the dash and copy rules, and from typographic quote changes.

## Design

**0.2.0: the look of an answer in a chat, not a report.** Pulkit's bar on 2026-10-26 was ChatGPT's Intelligent UI. openai.com refuses automated browsers, and the press coverage carries no screenshots, so the visual language was taken from OpenAI's own Apps SDK UI (MIT, github.com/openai/apps-sdk-ui): neutral greys, hairline borders at 8 to 10 percent, soft shadows, 16 to 24 px card radii, pill buttons with a near-black primary, tinted status badges, system fonts in few sizes, 150 ms state changes. Its UI guidelines add the rules kept here: at most two actions per card, actions that start a conversation turn, brand colour only on the primary button. Three places differ on purpose:
- Neutrals carry 0.005 chroma and the raised surface is 99.6 percent, not pure white: Hallmark's lint calls zero-chroma greys and pure white a reflex.
- The decision dock is solid, not glass: the lint warns on a blur over a translucent fill, and the floor allows no warning.
- Pills stay on controls and badges; dots and status icons are circles and bar tracks take small radii, per the lint's pill rule.

Every shape was screenshotted at 1280 and 390 px in both themes after each change, and judged against that bar; the fixes it forced are in the 0.2.0 changelog (names wrapping, a badge that doubled row height, a table 60 px too wide, phone rows six lines tall, a dock that took three rows before anything was picked).

**The trigger was the bigger gap.** On "lay out the options so I can choose one" the old description lost to prose, and a global "load the design skills" rule led the agent to hand-write HTML. The description now leads with the situation (an answer that makes the user compare, choose, read a long document, follow progress or review findings) and says to use the skill instead of hand-written HTML because its templates already pass a design check.

**Colour is reserved for meaning.** Chrome is ink on paper; the accent is ink. Every hue on a page is a semantic token, so a colour always says something. Bars in a chart are one neutral colour unless the rows carry an identity (five elements) or the agent names a colour column: the first screenshot painted build times with CI status, which the dataviz rules forbid.

**The five-element palette was computed, not picked.** A search over OKLCH candidates against the dataviz validator gave colour-blind separation ΔE 8.8 (light) and 8.6 (dark) over all pairs, normal-vision ΔE 17.4 and 15.3, and 3:1 contrast on every surface in both themes. Metal is iron grey on light paper and silver on dark, because white cannot show on white and gold collides with earth's ochre; it is under the chroma floor by design and named on every mark. Water is blue because black is the page's ink.

**Severity keeps three warm steps.** Critical, high and medium cannot also hold 3:1 on light paper and stay far apart (high against medium measures ΔE 8.0 light, 10.4 dark). Every swatch carries its word, as the dataviz status rule requires.

**Finance red points by locale,** with sources and confidence in `references/semantics.md`: red up in mainland China, Taiwan and Japan; red up and blue down in Korea (thin evidence, overridable); green up in Hong Kong and elsewhere.

**System fonts, light and dark, phone first.** Every page was swept at 320, 375 and 1280px in both themes with no horizontal scroll and no script errors. Two layout bugs were found that way and fixed: a grid track that let a table widen the page, and a visually hidden header label that escaped its scroll container.

## Honesty in the examples

**Real numbers only, so two examples changed.** The ComfyUI brief asked for quality, VRAM and speed. No single public source measures VRAM or speed across these models, so the page shows GenEval Overall from one table (Mage-Flow, arXiv 2607.19064v2, Table 9; every value checked against the fetched table), weight-file size from each Hugging Face listing as the stand-in for VRAM, and default steps from each model card as the stand-in for speed, each labelled as a stand-in. The five-element chart uses the five planets Chinese astronomy names for the elements, with NASA's fact sheet, instead of a made-up reading. The review example is the JSON an agent wrote from three real session logs, which are in `examples/sessions/`.

## Measured, not assumed

- **Speed.** A post-session review in a plain `claude -p` session (no MCP servers, default effort, no Artifact tool) had the checked page on disk at 33 seconds and answered at 43. The same prompt under this Mac's saved xhigh effort with the teamctx lookups its global instructions require took about 170 seconds. `SKILL.md` now says to build from what is known and not to re-verify.
- **Token cost.** Output tokens to write the content, tool overhead subtracted: review of 20 items 1,223 as text, 2,262 as this skill's JSON, about 4,450 as a hand-written HTML page; ComfyUI table 802 as text, 1,293 as JSON. `SKILL.md` itself is about 3,544 tokens.
- **Triggering.** The skill-creator's `run_eval.py` scored 1 of 10 positives, which was wrong: Claude Code 2.1.310 streams a partial assistant message with empty tool input first, and parallel runs share one commands folder. A checker with the same rule on complete messages gave 16/20 for the first description (6 of 10 triggers, no false triggers) and 17/20 for the final one (7 of 10, no false triggers). The three misses ("lay them out so I can choose", "make it navigable", "keep a checklist page updated") are prompts Claude answered or started directly. Capped at two rounds; the 20 queries are in `tests/trigger-evals.json`.
- **The description has no colons.** `skills-ref` rejected the first one: a colon followed by a space is a YAML mapping inside a plain scalar.

## Acceptance pass, 2026-10-26

Run on Pulkit's Mac (Claude Code 2.1.310, Node 26.8.2), with the skill linked into `~/.claude/skills/`.

- **Trigger without naming the skill.** `claude -p` with ten checkpoints and "show them to me as a table I can sort and let me pick one" loaded the skill as its first tool call, wrote the JSON, passed the check and opened the page in 47 s. The unattended guard worked: `waiting: skipped: this run is unattended`.
- **Send in a real browser.** `render --serve --wait`, then Chromium (Playwright) clicked a row and Send: the command printed `decision: Use model Z-Image-Turbo` and exited 0.
- **A served page leads with Send.** When the page can reach the agent, Send is the one-step path, so it takes the primary style and the first position; Copy stays as the fallback that always works.
- **Artifact target.** The ComfyUI example was rendered with `--target artifact` and published from a session that has the Artifact tool. Whether Copy is allowed inside the viewer is for a person to click; the page selects the line when the clipboard is refused.

## Left open

- `allowed-tools` is not set: it is experimental in the spec and its entries would contain spaces, so permission prompts stay with the user.
- Windows, WSL, Cursor and Antigravity paths are written but never run.
- Whether the Copy button works inside the claude.ai viewer was not clicked, only matched to the documented contract.
- Settled 2026-10-26: the repo moved to the `IndusCore-AI` organisation, and the manifest and README URLs now point there.
