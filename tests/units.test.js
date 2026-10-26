'use strict';
// Units: the template engine, text helpers, semantics, host detection and the shape builders.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { renderTemplate } = require('../scripts/lib/template');
const text = require('../scripts/lib/text');
const sem = require('../scripts/lib/semantics');
const host = require('../scripts/lib/host');
const { build, InputError } = require('../scripts/lib/shapes');

const fixture = (name) => JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
const ctx = { locale: 'en-US', clock: '12:00', liveSeconds: 5 };

test('text: escaping and the Markdown subset never pass raw HTML', () => {
  assert.equal(text.esc('<b a="1">&\'</b>'), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;');
  assert.equal(text.inline('<script>x</script> **bold**'), '&lt;script&gt;x&lt;/script&gt; <strong>bold</strong>');
  assert.equal(text.inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))');
  assert.match(text.inline('[ok](https://example.org)'), /href="https:\/\/example.org" rel="noopener noreferrer"/);
  assert.equal(text.blocks('- a\n- b\n\npara'), '<ul><li>a</li><li>b</li></ul>\n<p>para</p>');
  assert.equal(text.slug('Image models: ComfyUI!'), 'image-models-comfyui');
  assert.equal(text.typo("the card's steps"), 'the card\u2019s steps');
  assert.equal(text.typo('it says "fast" here'), 'it says \u201cfast\u201d here');
  assert.equal(text.blocks('say "x"', true), '<p>say &quot;x&quot;</p>');
});

test('text: number normalisation for the no-invented-numbers rule', () => {
  const n = text.numbersIn({ a: 142984, b: '12,104 km', c: [0.66, '2026-10-25'] });
  for (const v of ['142984', '12104', '0.66', '2026', '10', '25']) assert.ok(n.has(text.normNum(v)) || n.has(v), v);
  assert.equal(text.normNum('1,432.0'), '1432');
  assert.deepEqual('fp16 at 23.8 GB, v2, 4B and 12'.match(text.NUM_RE), ['23.8', '12']);
});

test('template: escapes, sections, inverted sections, zero counts as empty', () => {
  const view = { subject: '<x>', question: '', summary: 'ok', css: '', js: '', lang: 'en', finance: 'green-up', liveSeconds: '', shape: 'track',
    description: 'd', groups: [], done: 0, total: 0, failed: 0, share: '0', live: false, updated: '12:00', generated: 'g', generatedIso: 'i', source: '' };
  const html = renderTemplate('track', view);
  assert.match(html, /<title>&lt;x&gt;<\/title>/);
  assert.doesNotMatch(html, /class="question"/);
  assert.match(html, /class="summary">ok</);
  assert.doesNotMatch(html, /failed<\/span>/);
});

test('semantics: values find their meaning, in several languages', () => {
  assert.equal(sem.keyFor('five-elements', '火'), 'fire');
  assert.equal(sem.keyFor('five-elements', 'Water 水'), 'water');
  assert.equal(sem.keyFor('five-elements', '金星'), 'metal');
  assert.equal(sem.keyFor('five-elements', '목'), 'wood');
  assert.equal(sem.keyFor('severity', 'P1'), 'high');
  assert.equal(sem.keyFor('status', 'In progress'), 'running');
  assert.equal(sem.detect(['pass', 'fail', 'skipped'], 'ci'), 'status');
  assert.equal(sem.detect(['Wood', 'Fire'], 'element'), 'five-elements');
  assert.equal(sem.detect(['MIT', 'Apache'], 'licence'), null);
});

test('semantics: finance colours follow the locale', () => {
  assert.equal(sem.financeConvention('zh-CN'), 'red-up');
  assert.equal(sem.financeConvention('zh-TW'), 'red-up');
  assert.equal(sem.financeConvention('ja-JP'), 'red-up');
  assert.equal(sem.financeConvention('ko-KR'), 'red-up-blue-down');
  assert.equal(sem.financeConvention('zh-HK'), 'green-up');
  assert.equal(sem.financeConvention('en-US'), 'green-up');
  assert.equal(sem.direction('-2%'), 'down');
  assert.equal(sem.direction('+0.4'), 'up');
  assert.equal(sem.direction(0), 'flat');
});

test('host: detection order and the auto choice', () => {
  const codex = host.detect({ CODEX_CI: '1', CODEX_SANDBOX: 'seatbelt', CLAUDECODE: '1' }, 'darwin');
  assert.equal(codex.agent, 'codex');
  assert.equal(host.choose(codex).target, 'path');
  assert.equal(host.detect({ CLAUDECODE: '1' }, 'darwin').agent, 'claude-code');
  assert.equal(host.choose(host.detect({ CLAUDECODE: '1' }, 'darwin')).target, 'browser');
  assert.equal(host.choose(host.detect({ SSH_CONNECTION: '1 2 3 4' }, 'linux')).target, 'serve');
  assert.equal(host.choose(host.detect({}, 'linux')).target, 'path');
  assert.equal(host.choose(host.detect({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux')).target, 'browser');
  assert.equal(host.detect({ GEMINI_CLI: '1' }, 'darwin').agent, 'gemini-cli');
  assert.equal(host.detect({ CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'sdk-cli', CLAUDE_CODE_SESSION_ATTENDED: '0' }, 'darwin').attended, false);
  assert.equal(host.detect({ CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', CLAUDE_CODE_SESSION_ATTENDED: '1' }, 'darwin').attended, true);
});

test('shapes: every fixture builds', () => {
  for (const s of ['compare', 'choose', 'explain', 'track', 'inspect']) assert.ok(build(fixture(s), ctx), s);
});

test('shapes: bad input names what to fix', () => {
  const bad = (input) => { try { build(input, ctx); return null; } catch (e) { assert.ok(e instanceof InputError); return e.message; } };
  assert.match(bad({ shape: 'table', subject: 'x', data: {} }), /must be one of compare, choose, explain, track, inspect/);
  assert.match(bad({ shape: 'compare', data: { rows: [{ a: 1 }] } }), /"subject"/);
  assert.match(bad({ shape: 'compare', subject: 'x', data: { rows: [] } }), /data.rows/);
  assert.match(bad({ shape: 'compare', subject: 'x', data: { rows: [{ a: 3 }], columns: [{ key: 'a', type: 'rating' }] } }), /needs "max"/);
  assert.match(bad({ shape: 'choose', subject: 'x', data: { options: [{ title: 'only one' }] } }), /at least two/);
  assert.match(bad({ shape: 'track', subject: 'x', data: { items: [{ title: 't', status: 'sideways' }] } }), /status "sideways"/);
  assert.match(bad({ shape: 'inspect', subject: 'x', data: { items: [{ title: 't', severity: 'huge' }] } }), /severity "huge"/);
});

test('compare: picks, best values, blanks and chart colour', () => {
  const v = build(fixture('compare'), ctx);
  assert.equal(v.rows[1].pickPrompt, 'Use Beta for the fixture project');
  const cold = v.rows.map((r) => r.cells[1].html);
  assert.match(cold[1], /class="badge best"/);
  assert.match(cold[2], /not given/);
  assert.equal(v.chart.bars[2].blank, true);
  assert.ok(v.chart.bars.every((b) => b.sem === 'sem-series'), 'a measure is not painted with the CI status');
  const five = build(JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'five-elements.json'), 'utf8')), ctx);
  assert.deepEqual(five.chart.bars.map((b) => b.sem), ['sem-water', 'sem-metal', 'sem-fire', 'sem-wood', 'sem-earth']);
});

test('inspect: lanes, counts and one reply from several decisions', () => {
  const v = build(fixture('inspect'), ctx);
  assert.deepEqual(v.laneSections.map((l) => [l.key, l.count]), [['changed', 1], ['risky', 2], ['undecided', 1]]);
  assert.equal(v.laneSections[2].items[0].options[0].prompt, 'Keep the retry? Keep it');
  assert.ok(v.decide);
  assert.deepEqual(v.severities.map((s) => s.key), ['high', 'low']);
});

test('track: progress counts and live default', () => {
  const v = build(fixture('track'), ctx);
  assert.equal(v.done, 1);
  assert.equal(v.total, 4);
  assert.equal(v.live, true);
  assert.equal(build({ ...fixture('track'), data: { ...fixture('track').data, live: false } }, ctx).live, false);
});
