'use strict';
// Escaping, a small safe Markdown subset, number formatting and slugs. Node built-ins only.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

function slug(s, max = 48) {
  const out = String(s || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return out || 'page';
}

// Links in data become anchors only for http(s), mailto and in-page targets.
function safeHref(href) {
  const h = String(href || '').trim();
  if (/^(https?:\/\/|mailto:)/i.test(h) || /^#[\w-]+$/.test(h)) return h;
  return null;
}

// Prose typography: a straight apostrophe inside a word becomes a typographic one. Prompt lines are left exact.
const typo = (s) => String(s == null ? '' : s)
  .replace(/(\p{L})'(\p{L})/gu, '$1\u2019$2')
  .replace(/(^|[\s([])"([^"\n]+)"(?=[\s.,;:!?)\]]|$)/gu, '$1\u201c$2\u201d');

// Inline Markdown: `code`, **bold**, *italic*, [text](href). Everything else is escaped text.
function inline(src, raw = false) {
  const parts = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  const s = raw ? String(src == null ? '' : src) : typo(src);
  while ((m = re.exec(s))) {
    parts.push(esc(s.slice(last, m.index)));
    if (m[1] != null) parts.push(`<code>${esc(m[1])}</code>`);
    else if (m[2] != null) parts.push(`<strong>${esc(m[2])}</strong>`);
    else if (m[3] != null) parts.push(`<em>${esc(m[3])}</em>`);
    else {
      const href = safeHref(m[5]);
      parts.push(href ? `<a href="${esc(href)}"${href.startsWith('#') ? '' : ' rel="noopener noreferrer"'}>${esc(m[4])}</a>` : esc(m[0]));
    }
    last = re.lastIndex;
  }
  parts.push(esc(s.slice(last)));
  return parts.join('');
}

// Block Markdown: paragraphs, "- " and "1. " lists, "### " subheads, fenced code. No raw HTML passes.
function blocks(src, raw = false) {
  const lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null;
  let code = null;
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), raw)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, raw)}</li>`).join('')}</${list.tag}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (code) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(raw);
      continue;
    }
    if (/^```/.test(line)) { flushPara(); flushList(); code = []; continue; }
    let m;
    if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      flushPara();
      if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; }
      list.items.push(m[1]);
    } else if ((m = /^#{3,6}\s+(.*)$/.exec(line))) {
      flushPara(); flushList();
      out.push(`<h3>${inline(m[1], raw)}</h3>`);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  flushPara(); flushList();
  return out.join('\n');
}

// Numbers print as given when the agent passed a string, and with locale grouping when it passed a number.
function fmtNumber(v, locale) {
  if (typeof v !== 'number' || !isFinite(v)) return String(v);
  const opts = { maximumFractionDigits: 6, useGrouping: Math.abs(v) >= 10000 };
  try { return new Intl.NumberFormat(locale || 'en-US', opts).format(v); } catch { return String(v); }
}

// Every number that appears anywhere in the input, normalised, for the "nothing invented" rule.
function numbersIn(value, acc = new Set()) {
  if (value == null) return acc;
  if (typeof value === 'number') { acc.add(normNum(String(value))); return acc; }
  if (typeof value === 'string') { for (const n of value.match(NUM_RE) || []) acc.add(normNum(n)); return acc; }
  if (Array.isArray(value)) { for (const v of value) numbersIn(v, acc); return acc; }
  if (typeof value === 'object') { for (const [k, v] of Object.entries(value)) { numbersIn(k, acc); numbersIn(v, acc); } }
  return acc;
}
// A quantity: digits not glued to letters, so fp16, v2 and H100 are names, not numbers.
const NUM_RE = /(?<![\p{L}\d.,])\d[\d,]*(?:\.\d+)?(?![\p{L}\d])/gu;
function normNum(n) {
  let s = String(n).replace(/,/g, '');
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s.replace(/^0+(?=\d)/, '');
}

module.exports = { esc, typo, slug, inline, blocks, fmtNumber, numbersIn, normNum, NUM_RE, safeHref };
