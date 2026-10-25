# Hosts: where the page goes

The agent knows one thing the script cannot see: whether it has an Artifact tool. So the choice is made in two places.

1. **The agent** checks its own tool list. With an Artifact tool (Claude Code on a Pro, Max, Team or Enterprise plan signed in with `/login`), it runs `render --target artifact` and publishes the file. Without one, it runs `render` and lets the script decide.
2. **The script** (`scripts/lib/host.js`) reads the environment and picks the output.

| Situation | How it is detected | Output | Status |
| --- | --- | --- | --- |
| Claude Code, Artifact tool present | the agent sees the tool | `--target artifact`: the page written as a fragment and checked, then published by the agent | published and read back 2026-10-25; not seen rendered in the viewer |
| Claude Code, no Artifact tool (API key, Bedrock, Vertex, Foundry, ZDR, `-p`, `CLAUDE_CODE_DISABLE_ARTIFACT=1`) | `CLAUDECODE=1` | opens the browser; `--wait` is skipped when the run is unattended | measured in 2.1.310: `CLAUDE_CODE_ENTRYPOINT=cli` and `CLAUDE_CODE_SESSION_ATTENDED=1` interactive, `sdk-cli` and `0` under `-p` |
| Codex CLI, sandboxed | `CODEX_THREAD_ID`, `CODEX_SESSION_ID` or `CODEX_CI`; `CODEX_SANDBOX` | prints the path; no server | measured, see below; `codex exec` needs `--sandbox workspace-write` |
| SSH session | `SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` | serves on 127.0.0.1, prints the URL and an `ssh -L` line | measured in Linux (Docker) |
| Linux desktop | `DISPLAY` or `WAYLAND_DISPLAY` | `xdg-open` | measured in Linux (Docker): failure paths only, no browser there |
| Linux without a display | neither set | prints the path | measured in Linux (Docker) |
| macOS | `process.platform` | `open` | measured on macOS 26 |
| Windows | `process.platform` | `cmd /d /s /c start "" "<file>"` | **unverified**: no Windows machine was available |
| WSL | `/proc/version` names Microsoft | `wslview` if installed, else as Linux | **unverified** |
| Gemini CLI | `GEMINI_CLI=1` | opens the browser | from source (`shellExecutionService.ts`), not run |
| Antigravity CLI | not known | falls through to the desktop rule | **unverified**: not installed here; it replaced Gemini CLI on 2026-06-18 and may keep `GEMINI_CLI` |
| Cursor (agent terminal) | any `CURSOR_*` variable, else `TERM_PROGRAM=vscode` | opens the browser | **unverified**: Cursor not installed here; its `/canvas` renders React artifacts the agent writes, so this skill does not target it in v1 |
| VS Code terminal | `TERM_PROGRAM=vscode` | opens the browser | documented; no webview path exists for a skill |
| claude.ai (skill uploaded as a ZIP, code execution on) | no shell markers | the agent should present the file as an artifact | **unverified** |

The path is printed in every case. Every open failure is reported as `opened: no, <command> failed: <reason>` followed by `next: give the user this path`.

## What was measured, 2026-10-25

**Claude Code 2.1.310, macOS, CLI.** The shell sees `CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT=cli`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_EXECPATH`, `CLAUDE_EFFORT`, `TERM_PROGRAM=Apple_Terminal`. `open <file>` exits 0 and the default browser shows the page.

**Codex CLI 0.164.0-alpha.11.1** (bundled in the ChatGPT app), `codex exec` with its defaults, macOS. A shell tool call sees:

```
CODEX_CI=1
CODEX_PERMISSION_PROFILE=:read-only
CODEX_SANDBOX=seatbelt
CODEX_SANDBOX_NETWORK_DISABLED=1
CODEX_SESSION_ID=<uuid>   CODEX_THREAD_ID=<same uuid>   CODEX_TOOL_CALL_ID=<id>   CODEX_VERSION=0.164.0-alpha.11.1
```

`open probe.html` fails inside the seatbelt sandbox: `No application knows how to open URL file:///... (kLSExecutableIncorrectFormat)`, exit 1. That is why a sandboxed Codex session gets the path, not a browser. The Codex source at openai/codex 970111f (2026-10-23) defines the same variables (`codex-rs/core/src/spawn.rs`, `exec_env.rs`, `protocol/src/shell_environment.rs`).

Codex launched from inside Claude Code inherited `CLAUDECODE=1` as well, so the script checks the Codex markers first.

With the skill in `.agents/skills/` of a test project, three natural-language prompts:

| Prompt | Sandbox | Result |
| --- | --- | --- |
| "Show them to me as a UI I can sort, and let me pick which model to use" (a CSV of ten models) | default (`:read-only`) | no page: nothing can be written; Codex read the renderer and said so |
| the same | `workspace-write` | page checked and written in 18 s, path printed; it asked for `--serve --wait`, and the server failed with `listen EPERM` (render now skips serving in the sandbox) |
| "one page of what changed, what is risky and what is undecided" (three session logs) | `workspace-write` | page checked and written in 40 s, browser blocked, path printed |
| "make me a chart of their orbital periods where each planet wears its element's colour" | `workspace-write` | Codex's own bundled `visualize` skill answered instead |
| the same, starting "Use the intelligent-ui-anything skill" | `workspace-write` | page checked and written in 18 s, each bar in its element's class, path printed |

The Codex app has an inline surface for HTML: its bundled `visualize` skill writes an HTML fragment to a task-owned folder and puts a `visualize{"path": "<absolute path>"}` line in the reply. This skill does not use it yet (not verified in the desktop app).

**Linux, Docker `node:22-slim` (Node 22.23.4, aarch64, Ubuntu host engine 29.5.2):**

| Case | Result |
| --- | --- |
| no `DISPLAY`, no SSH | `opened: no (no display found)` and the path |
| `DISPLAY=:0`, xdg-utils not installed | `opened: no, xdg-open failed: xdg-open is not installed` and the path |
| `DISPLAY=:0`, xdg-utils 1.1.3, no browser | `opened: no, xdg-open failed: exit 3, no browser found` and the path |
| `SSH_CONNECTION` set | server on 127.0.0.1, `url:` and `tunnel: ... ssh -L <port>:127.0.0.1:<port> <host>`; the page answered 200 over the URL; a POST of a pick wrote the decision file; the server kept serving |

`xdg-open` is for desktop sessions only and exits 3 when it finds no tool (xdg-open(1)). The script waits 2.5 seconds for it: a non-zero exit inside that window is a failure, a process still running (a browser started in the foreground) counts as opened.

## The decision server

`scripts/serve` (also `render --serve`) binds 127.0.0.1 only, on a random port, under a random 24-character path. It answers three requests and nothing else: the page, the page's version (for live reload), and a JSON POST of the pick. It refuses a request whose `Host` is not that loopback address (421, against DNS rebinding), a POST from another origin (403), a body that is not JSON (415) or over 32 KB (413). It writes the pick to `<page>.decision.json`, prints `decision: <line>`, and stops after 30 minutes without a request. All six refusals and the round trip were exercised on 2026-10-25.

Over SSH the server is reachable only through a tunnel the user opens. VS Code Remote and similar tools may forward the port on their own (unverified).

## Artifacts in Claude Code

The Artifact tool exists only on Pro, Max, Team and Enterprise plans with `/login`, and not with an API key, gateway token, Bedrock, Vertex, Foundry, CMEK, HIPAA or ZDR, in `-p` mode, the Agent SDK or when `CLAUDE_CODE_DISABLE_ARTIFACT=1` is set (code.claude.com/docs/en/artifacts, read 2026-10-25). An artifact page may only fetch its own origin, so it cannot reach the local decision server: inside an artifact, the pick comes back by the Copy button.

The tool wraps every published file in its own document (a charset and viewport meta, a small reset, safe-area padding on `:root`), so `--target artifact` writes the page as a fragment: `<title>`, a `claude:viewport-fit-sides` meta, the style, the page and the script. The viewer sets `data-theme` on the root, which the theme tokens read; the page's own theme switch is left out there. Published once (the ComfyUI example) and read back: the service stored the fragment inside its skeleton as expected. The artifact contract says the Copy button works when `navigator.clipboard.writeText` runs in the click handler and that some app views refuse it, which is the case the page handles by selecting the line instead; this was not clicked in the viewer.
