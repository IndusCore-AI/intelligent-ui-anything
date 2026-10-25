'use strict';
// A small logic-less template engine (a Mustache subset): {{name}} escapes, {{{name}}} inserts prepared HTML,
// {{#name}}...{{/name}} repeats over a list or shows when truthy, {{^name}}...{{/name}} shows when empty or false,
// {{>partial}} includes assets/templates/_partial.html, {{.}} is the current item. Dotted names reach into objects.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { esc } = require('./text');

const TEMPLATES = join(__dirname, '..', '..', 'assets', 'templates');
const cache = new Map();

function load(name) {
  if (!/^_?[a-z-]+$/.test(name)) throw new Error(`bad template name: ${name}`);
  if (!cache.has(name)) cache.set(name, parse(readFileSync(join(TEMPLATES, `${name}.html`), 'utf8'), name));
  return cache.get(name);
}

function parse(src, name) {
  const root = { children: [] };
  const stack = [root];
  const re = /\{\{(\{?)\s*([#^/>]?)\s*([\w.]+|\.)\s*\}?\}\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push({ t: 'text', v: src.slice(last, m.index) });
    last = re.lastIndex;
    const [, raw, sigil, key] = m;
    if (sigil === '#' || sigil === '^') {
      const node = { t: sigil === '#' ? 'section' : 'inverted', key, children: [] };
      top.children.push(node);
      stack.push(node);
    } else if (sigil === '/') {
      const open = stack.pop();
      if (!open || open.key !== key) throw new Error(`${name}: {{/${key}}} closes ${open && open.key}`);
    } else if (sigil === '>') {
      top.children.push({ t: 'partial', key });
    } else {
      top.children.push({ t: raw ? 'raw' : 'var', key });
    }
  }
  if (stack.length !== 1) throw new Error(`${name}: unclosed {{#${stack[stack.length - 1].key}}}`);
  if (last < src.length) root.children.push({ t: 'text', v: src.slice(last) });
  return root.children;
}

function lookup(ctxs, key) {
  if (key === '.') return ctxs[ctxs.length - 1];
  const [head, ...rest] = key.split('.');
  for (let i = ctxs.length - 1; i >= 0; i--) {
    const c = ctxs[i];
    if (c != null && typeof c === 'object' && head in c) {
      let v = c[head];
      for (const k of rest) v = v == null ? undefined : v[k];
      return v;
    }
  }
  return undefined;
}

const empty = (v) => v == null || v === false || v === '' || v === 0 || (Array.isArray(v) && v.length === 0);

function run(nodes, ctxs) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'var') { const v = lookup(ctxs, n.key); out += v == null ? '' : esc(v); }
    else if (n.t === 'raw') { const v = lookup(ctxs, n.key); out += v == null ? '' : String(v); }
    else if (n.t === 'partial') out += run(load(`_${n.key}`), ctxs);
    else if (n.t === 'section') {
      const v = lookup(ctxs, n.key);
      if (empty(v)) continue;
      if (Array.isArray(v)) for (const item of v) out += run(n.children, [...ctxs, item]);
      else out += run(n.children, typeof v === 'object' ? [...ctxs, v] : ctxs);
    } else if (n.t === 'inverted') {
      if (empty(lookup(ctxs, n.key))) out += run(n.children, ctxs);
    }
  }
  return out;
}

const renderTemplate = (name, view) => run(load(name), [view]);

module.exports = { renderTemplate, TEMPLATES };
