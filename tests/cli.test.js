'use strict';
// The command line and the decision server, end to end.
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, existsSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const http = require('node:http');
const { startServer } = require('../scripts/lib/server');

const root = join(__dirname, '..');
const out = mkdtempSync(join(tmpdir(), 'iua-test-'));
const run = (args, input) => spawnSync(process.execPath, [join(root, 'scripts', 'render'), ...args], { encoding: 'utf8', input, env: { ...process.env, IUA_OUT_DIR: out } });

test('render writes, checks and reports a path without opening anything', () => {
  const r = run([join(__dirname, 'fixtures', 'compare.json'), '--target', 'path']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^page: .*test-fixture-three-build-tools\.html$/m);
  assert.match(r.stdout, /^check: pass/m);
  assert.match(r.stdout, /^opened: no/m);
  assert.ok(existsSync(join(out, 'test-fixture-three-build-tools.html')));
});

test('render reads JSON from stdin and targets an artifact', () => {
  const r = run(['-', '--target', 'artifact'], readFileSync(join(__dirname, 'fixtures', 'choose.json'), 'utf8'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^next: publish this file with your Artifact tool/m);
});

test('render refuses bad input with exit 2 and a page that fails the floor with exit 3', () => {
  const bad = run(['-', '--target', 'path'], JSON.stringify({ shape: 'pie', subject: 'x', data: {} }));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /must be one of/);
  const f = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'compare.json'), 'utf8'));
  f.question = 'Which tool — honestly?';
  const fail = run(['-', '--target', 'path'], JSON.stringify(f));
  assert.equal(fail.status, 3);
  assert.match(fail.stdout, /^check: FAIL/m);
  assert.doesNotMatch(fail.stdout, /^opened:/m);
});

test('check --templates passes', () => {
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'check'), '--templates'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.equal((r.stdout.match(/: pass\./g) || []).length, 5);
});

function request(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('the decision server serves one page, refuses the rest, and returns the pick', async () => {
  const page = join(out, 'served.html');
  writeFileSync(page, '<!doctype html><meta name="iua-endpoint" content=""><meta name="iua-version" content=""><p>x</p>');
  const decisionFile = join(out, 'served.decision.json');
  let got = null;
  const s = await startServer({ page, decisionFile, onDecision: (d) => { got = d; } });
  try {
    const port = s.port;
    const base = s.url;
    const okPage = await request(base);
    assert.equal(okPage.status, 200);
    assert.match(okPage.body, /content="\/t\/[\w-]+\/decision"/);
    assert.equal((await request(base, { headers: { Host: `evil.example:${port}` } })).status, 421);
    assert.equal((await request(`http://127.0.0.1:${port}/t/wrong/`)).status, 404);
    const json = { 'Content-Type': 'application/json' };
    assert.equal((await request(`${base}decision`, { method: 'POST', headers: { ...json, Origin: 'https://evil.example' }, body: '{"prompt":"x"}' })).status, 403);
    assert.equal((await request(`${base}decision`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{"prompt":"x"}' })).status, 415);
    assert.equal((await request(`${base}decision`, { method: 'POST', headers: json, body: JSON.stringify({ prompt: 'x'.repeat(40000) }) })).status, 413);
    assert.equal((await request(`${base}decision`, { method: 'POST', headers: json, body: '{"nope":1}' })).status, 400);
    const ok = await request(`${base}decision`, { method: 'POST', headers: { ...json, Origin: `http://127.0.0.1:${port}` }, body: JSON.stringify({ prompt: 'Use model Z-Image-Turbo', picks: [] }) });
    assert.equal(ok.status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(got.prompt, 'Use model Z-Image-Turbo');
    assert.equal(JSON.parse(readFileSync(decisionFile, 'utf8')).prompt, 'Use model Z-Image-Turbo');
  } finally {
    s.server.close();
    s.server.closeAllConnections();
  }
});
