'use strict';
// The decision return: a loopback-only server for one page. It serves that page and nothing else,
// takes one kind of request back (the pick), writes it to a file the agent reads, and exits when idle.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { readFileSync, writeFileSync, statSync, renameSync } = require('node:fs');

const MAX_BODY = 32 * 1024;
const HOST = '127.0.0.1';

function startServer({ page, port = 0, token = randomBytes(18).toString('base64url'), decisionFile, idleSeconds = 1800, onDecision, log = () => {} }) {
  const base = `/t/${token}/`;
  let lastActivity = Date.now();
  let origin = null;

  const pageHtml = () => readFileSync(page, 'utf8')
    .replace('<meta name="iua-endpoint" content="">', `<meta name="iua-endpoint" content="${base}decision">`)
    .replace('<meta name="iua-version" content="">', `<meta name="iua-version" content="${base}version">`);

  const send = (res, status, type, body, extra = {}) => {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      ...extra,
    });
    res.end(body);
  };

  const server = http.createServer((req, res) => {
    lastActivity = Date.now();
    const host = String(req.headers.host || '');
    // DNS rebinding guard: only answer requests addressed to this loopback port by name.
    if (host !== `127.0.0.1:${server.address().port}` && host !== `localhost:${server.address().port}`) return send(res, 421, 'text/plain', 'wrong host\n');
    const url = req.url.split('?')[0];
    if (req.method === 'GET' && (url === base || url === base.slice(0, -1))) return send(res, 200, 'text/html; charset=utf-8', pageHtml());
    if (req.method === 'GET' && url === `${base}version`) {
      let v = '0';
      try { v = String(statSync(page).mtimeMs); } catch { /* page removed */ }
      return send(res, 200, 'text/plain', v);
    }
    if (req.method === 'POST' && url === `${base}decision`) {
      // CSRF guard: the pick must come from this page's own origin, as JSON.
      const from = req.headers.origin;
      if (from && from !== `http://127.0.0.1:${server.address().port}` && from !== `http://localhost:${server.address().port}`) return send(res, 403, 'text/plain', 'wrong origin\n');
      if (!/^application\/json\b/.test(String(req.headers['content-type'] || ''))) return send(res, 415, 'text/plain', 'json only\n');
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { send(res, 413, 'text/plain', 'too large\n'); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (size > MAX_BODY) return;
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, 'text/plain', 'bad json\n'); }
        if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 8000) return send(res, 400, 'text/plain', 'missing prompt\n');
        const decision = {
          prompt: body.prompt,
          picks: Array.isArray(body.picks) ? body.picks.slice(0, 200) : [],
          note: typeof body.note === 'string' ? body.note.slice(0, 2000) : '',
          subject: typeof body.subject === 'string' ? body.subject.slice(0, 300) : '',
          shape: typeof body.shape === 'string' ? body.shape.slice(0, 20) : '',
          page,
          at: new Date().toISOString(),
        };
        if (decisionFile) {
          writeFileSync(`${decisionFile}.tmp`, JSON.stringify(decision, null, 2) + '\n');
          renameSync(`${decisionFile}.tmp`, decisionFile);
        }
        send(res, 200, 'application/json', JSON.stringify({ ok: true }) + '\n');
        if (onDecision) setImmediate(() => onDecision(decision));
      });
      return undefined;
    }
    return send(res, 404, 'text/plain', 'not found\n');
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, HOST, () => {
      origin = `http://${HOST}:${server.address().port}`;
      const idle = setInterval(() => {
        if (Date.now() - lastActivity > idleSeconds * 1000) {
          log(`no activity for ${idleSeconds}s; stopping the server`);
          clearInterval(idle);
          server.close();
          server.emit('idle-exit');
        }
      }, 1000);
      idle.unref();
      server.on('close', () => clearInterval(idle));
      resolve({ server, url: `${origin}${base}`, port: server.address().port, token });
    });
  });
}

module.exports = { startServer };
