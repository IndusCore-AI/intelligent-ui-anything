'use strict';
// The floor: every template passes, and each rule fails when its problem is planted.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { renderPage } = require('../scripts/render');
const { checkPage } = require('../scripts/check');

const now = new Date('2026-10-25T12:00:00Z');
const fixture = (name) => JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8'));
const failing = (res) => [...res.rules.filter((r) => !r.ok).map((r) => `floor ${r.id}`), ...res.lint.fails.map((f) => `lint ${f.gate}`), ...res.lint.reflex.map((f) => `reflex ${f.gate}`)];

test('every shape template passes the floor and the lint', () => {
  for (const s of ['compare', 'choose', 'explain', 'track', 'inspect']) {
    const input = fixture(s);
    const res = checkPage(renderPage(input, { now }).html, { data: input });
    assert.deepEqual(failing(res), [], s);
    assert.equal(res.lint.warns.length, 0, `${s} has lint warnings`);
  }
});

test('every example passes', () => {
  const dir = join(__dirname, '..', 'examples');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const input = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    assert.deepEqual(failing(checkPage(renderPage(input, { now }).html, { data: input })), [], f);
  }
});

test('planted problems fail the rule that guards them', () => {
  const input = fixture('compare');
  const html = renderPage(input, { now }).html;
  const cases = [
    ['an em dash in the copy', { ...input, question: 'Which one \u2014 really?' }, null, /floor 6/],
    ['a number the input never gave', { ...input, summary: 'Alpha is 40 percent faster.' }, null, /floor 5/],
    ['a colour literal', null, html.replace('<span class="tag">', '<span class="tag" style="color: #ff0000">'), /floor 1/],
    ['transition: all', null, html.replace('</style>', '.x { transition: all 1s; }\n</style>'), /floor 2/],
    ['an outline removed', null, html.replace('</style>', '.y:focus { outline: none; }\n</style>'), /floor 3/],
    ['a dark theme dropped', null, html.replace(':root[data-theme="dark"] {', ':root[data-mode="night"] {'), /floor 7/],
    ['a wide fixed width', null, html.replace('</style>', '.z { width: 900px; }\n</style>'), /floor 8/],
    ['a 100vw width', null, html.replace('</style>', '.w { max-width: 100vw; }\n</style>'), /floor 9/],
    ['content written by script', null, html.replace('(function () {', '(function () { document.body.innerHTML = ""; '), /floor 10/],
    ['a script from a CDN', null, html.replace('</head>', '<script src="https://cdn.example.org/x.js"></script></head>'), /floor S1/],
    ['a credit line', null, html.replace('<p>Generated', '<p>Made with intelligent-ui-anything. Generated'), /floor S2/],
    ['a buzzword', { ...input, question: 'Which tool gives a seamless build?' }, null, /lint 19/],
  ];
  for (const [name, changedInput, changedHtml, expect] of cases) {
    const page = changedHtml || renderPage(changedInput, { now }).html;
    const res = checkPage(page, { data: changedInput || input });
    assert.equal(res.ok, false, `${name} should fail`);
    assert.match(failing(res).join(' '), expect, name);
  }
});

test('the user\'s own data may name the tool and its maker; the page may not add them', () => {
  const input = { ...fixture('inspect'), subject: 'Review of the intelligent-ui-anything repo at IndusCore' };
  assert.equal(checkPage(renderPage(input, { now }).html, { data: input }).ok, true);
});

test('quoted source text may keep its own dashes', () => {
  const input = fixture('explain');
  assert.ok(input.data.sections[1].body.includes('\u2014'));
  assert.equal(checkPage(renderPage(input, { now }).html, { data: input }).ok, true);
  const notVerbatim = { ...input, data: { ...input.data, verbatim: false } };
  assert.equal(checkPage(renderPage(notVerbatim, { now }).html, { data: notVerbatim }).ok, false);
});
