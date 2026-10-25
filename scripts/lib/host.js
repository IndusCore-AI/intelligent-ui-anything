'use strict';
// Where the page should go. Read references/hosts.md for what each marker is and how it was measured.
const { spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');

function detect(env = process.env, platform = process.platform) {
  const has = (k) => env[k] != null && env[k] !== '';
  // Codex first: a Codex shell inherits CLAUDECODE when Codex itself was started from Claude Code (measured).
  let agent = 'unknown';
  if (has('CODEX_THREAD_ID') || has('CODEX_SESSION_ID') || has('CODEX_CI')) agent = 'codex';
  else if (env.CLAUDECODE === '1') agent = 'claude-code';
  else if (env.GEMINI_CLI === '1') agent = 'gemini-cli';
  else if (Object.keys(env).some((k) => k.startsWith('CURSOR_'))) agent = 'cursor';
  else if (env.TERM_PROGRAM === 'vscode') agent = 'vscode-terminal';
  const remote = has('SSH_CONNECTION') || has('SSH_CLIENT') || has('SSH_TTY');
  const sandboxed = has('CODEX_SANDBOX');
  let wsl = false;
  if (platform === 'linux') {
    try { wsl = /microsoft/i.test(readFileSync('/proc/version', 'utf8')); } catch { /* not linux proper */ }
  }
  const display = platform === 'darwin' || platform === 'win32' || wsl || has('DISPLAY') || has('WAYLAND_DISPLAY');
  return { agent, remote, sandboxed, display, platform, wsl, entry: env.CLAUDE_CODE_ENTRYPOINT || '' };
}

// auto: SSH -> serve on localhost; Codex sandbox -> path (measured: open fails inside seatbelt);
// a desktop -> open the browser; anything else -> print the path.
function choose(host) {
  if (host.remote) return { target: 'serve', why: 'SSH session: the page is served on this machine\'s localhost' };
  if (host.sandboxed) return { target: 'path', why: 'Codex sandbox: opening a browser is blocked inside it' };
  if (host.display) return { target: 'browser', why: 'desktop session' };
  return { target: 'path', why: 'no display found' };
}

function which(cmd) {
  const dirs = String(process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  return dirs.some((d) => d && existsSync(`${d}/${cmd}`));
}

// Starts a command without waiting on it: a non-zero exit within the grace period is a failure, a process still
// running after it (a browser started in the foreground) counts as opened.
function launch(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    let child;
    let err = '';
    try {
      child = spawn(cmd, args, { detached: true, stdio: ['ignore', 'ignore', 'pipe'], ...opts });
    } catch (e) { resolve({ ok: false, error: e.message }); return; }
    const timer = setTimeout(() => { child.stderr.destroy(); child.unref(); resolve({ ok: true }); }, 2500);
    child.stderr.on('data', (b) => { err += b; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: e.message }); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { ok: true } : { ok: false, error: err.trim().split('\n')[0] || `exit ${code}${cmd === 'xdg-open' && code === 3 ? ' (no browser found)' : ''}` });
    });
  });
}

// Opens a file or URL in the default browser. Resolves to { ok, how, error }; never throws.
async function openInBrowser(target, host = detect()) {
  const isUrl = /^https?:\/\//.test(target);
  if (host.platform === 'darwin') return { how: 'open', ...(await launch('open', [target])) };
  if (host.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    return { how: 'start', ...(await launch(comspec, ['/d', '/s', '/c', `start "" "${target}"`], { windowsVerbatimArguments: true, windowsHide: true })) };
  }
  if (host.wsl && which('wslview')) return { how: 'wslview', ...(await launch('wslview', [isUrl ? target : pathToFileURL(target).href])) };
  if (!which('xdg-open')) return { ok: false, how: 'xdg-open', error: 'xdg-open is not installed' };
  return { how: 'xdg-open', ...(await launch('xdg-open', [target])) };
}

module.exports = { detect, choose, openInBrowser };
