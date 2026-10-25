'use strict';
// The floor: ten rules every page passes before it opens, plus two security rules (offline, no credit).
// Each rule returns { id, name, ok, detail }. The vendored lint runs beside these (scripts/check).
const { parseColor, contrast, resolve } = require('./color');
const { numbersIn, normNum, fmtNumber, NUM_RE } = require('./text');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '...' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
});

// Walks the markup and reports each run of text with the flags of the elements around it.
function walk(html, onText, onTag = () => {}) {
  const stack = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  const flag = (k) => stack.some((s) => s[k]);
  while ((m = re.exec(html))) {
    if (m[0].startsWith('<!--')) continue;
    if (m[4] != null) {
      onText(decode(m[4]), { verbatim: flag('verbatim'), derived: flag('derived'), raw: flag('raw'), hidden: flag('hidden'), head: flag('head') });
      continue;
    }
    const close = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3] || '';
    if (close) {
      const i = stack.map((s) => s.name).lastIndexOf(name);
      if (i !== -1) stack.length = i;
      continue;
    }
    const has = (a) => new RegExp(`(^|\\s)${a}(\\s|=|$|/)`, 'i').test(attrs);
    onTag(name, attrs, { hidden: flag('hidden') || has('hidden') });
    if (VOID.has(name) || attrs.trim().endsWith('/')) continue;
    stack.push({ name, verbatim: has('data-verbatim'), derived: has('data-derived'), raw: name === 'script' || name === 'style', hidden: has('hidden'), head: name === 'head' });
    if (name === 'script' || name === 'style') {
      const end = html.indexOf(`</${name}`, re.lastIndex);
      re.lastIndex = end === -1 ? html.length : end;
    }
  }
}

// CSS: a flat list of { selector, media, decls } with comments removed.
function parseCss(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const walkBlock = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) break;
      const selector = text.slice(i, open).trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (selector.startsWith('@media') || selector.startsWith('@supports')) walkBlock(body, selector);
      else if (!selector.startsWith('@')) {
        const decls = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
          const c = d.indexOf(':');
          return { prop: d.slice(0, c).trim().toLowerCase(), value: d.slice(c + 1).trim() };
        }).filter((d) => d.prop);
        rules.push({ selector, media: media || '', decls });
      }
      i = j;
    }
  };
  walkBlock(src, '');
  return rules;
}

const TOKEN_SEL = /^(?:html|:root)?(?:\[data-(?:theme|mode|scheme)[^\]]*\]|:root|:not\([^)]*\))*$/i;
const isToken = (r) => r.selector.split(',').every((p) => TOKEN_SEL.test(p.trim()));
const COLOR_LIT = /#[0-9a-f]{3,8}\b|(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/i;
const GENERIC = new Set(['inherit', 'initial', 'unset', 'serif', 'sans-serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-monospace', 'ui-serif', 'cursive', 'fantasy']);

function themes(rules) {
  const light = {}, darkMedia = {}, darkAttr = {};
  for (const r of rules) {
    if (!isToken(r)) continue;
    const target = /prefers-color-scheme:\s*dark/.test(r.media) ? darkMedia : /data-theme="?dark/.test(r.selector) ? darkAttr : r.media ? null : /data-theme="?light/.test(r.selector) ? null : light;
    if (!target) continue;
    for (const d of r.decls) if (d.prop.startsWith('--')) target[d.prop] = d.value;
  }
  return { light, darkMedia, darkAttr };
}

const TEXT_PAIRS = [
  ['--color-ink', '--color-paper'], ['--color-ink', '--color-well'], ['--color-ink', '--color-raised'],
  ['--color-ink-2', '--color-paper'], ['--color-ink-2', '--color-well'], ['--color-ink-2', '--color-raised'],
  ['--color-muted', '--color-paper'], ['--color-muted', '--color-well'], ['--color-muted', '--color-raised'],
  ['--color-accent-ink', '--color-accent'], ['--color-ink', '--color-add-wash'], ['--color-ink', '--color-del-wash'],
];
const MARKS = ['--color-focus', '--color-edge', '--color-wood', '--color-fire', '--color-earth', '--color-metal', '--color-water',
  '--color-red', '--color-orange', '--color-amber', '--color-green', '--color-blue', '--color-grey'];
const SURFACES = ['--color-paper', '--color-well', '--color-raised'];

function contrastFailures(tokens, label) {
  const bad = [];
  const col = (k) => parseColor(resolve(tokens[k] || '', tokens));
  for (const [fg, bg] of TEXT_PAIRS) {
    const a = col(fg), b = col(bg);
    if (!a || !b) { bad.push(`${label}: ${fg} or ${bg} is missing`); continue; }
    const r = contrast(a, b);
    if (r < 4.5) bad.push(`${label}: ${fg} on ${bg} is ${r.toFixed(2)}:1, under 4.5:1`);
  }
  for (const fg of MARKS) for (const bg of SURFACES) {
    const a = col(fg), b = col(bg);
    if (!a || !b) { bad.push(`${label}: ${fg} or ${bg} is missing`); continue; }
    const r = contrast(a, b);
    if (r < 3) bad.push(`${label}: ${fg} on ${bg} is ${r.toFixed(2)}:1, under 3:1`);
  }
  return bad;
}

function check(html, { data = null, locale = 'en-US' } = {}) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  const rules = parseCss(css);
  const texts = [];
  const tags = [];
  walk(html, (t, f) => texts.push({ t, f }), (name, attrs, f) => tags.push({ name, attrs, f }));
  const visible = texts.filter((x) => !x.f.raw && !x.f.head);
  const results = [];
  const add = (id, name, problems) => results.push({ id, name, ok: problems.length === 0, detail: problems.slice(0, 6) });

  // 1. Tokens only.
  {
    const p = [];
    for (const r of rules) {
      if (isToken(r)) continue;
      for (const d of r.decls) {
        if (d.prop.startsWith('--')) { if (COLOR_LIT.test(d.value)) p.push(`${r.selector}: ${d.prop} holds a colour literal`); continue; }
        if (COLOR_LIT.test(d.value)) p.push(`${r.selector}: ${d.prop}: ${d.value}`);
        if (d.prop === 'font-family' && !/var\(/.test(d.value) && !GENERIC.has(d.value.split(',')[0].trim().replace(/["']/g, '').toLowerCase())) p.push(`${r.selector}: font-family literal`);
      }
    }
    for (const t of tags) { const s = /\sstyle\s*=\s*"([^"]*)"/i.exec(t.attrs); if (s && COLOR_LIT.test(s[1])) p.push(`inline style on <${t.name}> holds a colour`); }
    add(1, 'Colours and fonts come from tokens only', p);
  }
  // 2. No transition: all.
  add(2, 'No transition: all', rules.flatMap((r) => r.decls.filter((d) => (d.prop === 'transition' || d.prop === 'transition-property') && /(^|[\s,])all\b/.test(d.value)).map(() => `${r.selector}: transition all`)));
  // 3. Focus rings.
  {
    const p = [];
    const ring = rules.some((r) => /:focus-visible/.test(r.selector) && r.decls.some((d) => d.prop === 'outline' && !/^(none|0)\b/.test(d.value)));
    if (!ring) p.push('no :focus-visible rule draws an outline');
    for (const r of rules) {
      if (!r.decls.some((d) => (d.prop === 'outline' || d.prop === 'outline-style') && /^(none|0)\b/.test(d.value))) continue;
      const base = r.selector.replace(/:focus-visible|:focus/g, '').trim();
      const replaced = rules.some((o) => /:has\([^)]*:focus-visible/.test(o.selector) && o.decls.some((d) => d.prop === 'outline' && !/^(none|0)\b/.test(d.value)) && base.split(/\s+/).some((part) => o.selector.includes(part.replace(/\s.*$/, ''))));
      if (!replaced) p.push(`${r.selector} removes the outline with nothing in its place`);
    }
    add(3, 'Every control shows an instant focus ring', p);
  }
  // 4. Contrast in both themes.
  {
    const { light, darkAttr } = themes(rules);
    add(4, 'Body text 4.5:1 and marks 3:1, light and dark', [...contrastFailures(light, 'light'), ...contrastFailures({ ...light, ...darkAttr }, 'dark')]);
  }
  // 5. Nothing invented: every number on the page comes from the structured data (rows, options, items, sections)
  // or the source line, or is a count the page derived. The page-level prose (title, question, summary, notes,
  // chart captions) may only repeat numbers the data holds, so a claim like "40% faster" needs a row behind it.
  {
    const p = [];
    if (data) {
      const facts = JSON.parse(JSON.stringify(data.data || data));
      delete facts.notes;
      if (facts.chart && typeof facts.chart === 'object') { delete facts.chart.title; delete facts.chart.note; }
      const allowed = numbersIn(facts);
      numbersIn(data.source, allowed);
      const addFormatted = (v) => {
        if (typeof v === 'number') for (const n of fmtNumber(v, locale).match(NUM_RE) || []) allowed.add(normNum(n));
        else if (Array.isArray(v)) v.forEach(addFormatted);
        else if (v && typeof v === 'object') Object.values(v).forEach(addFormatted);
      };
      addFormatted(facts);
      for (const { t, f } of visible) {
        if (f.derived) continue;
        for (const n of t.match(NUM_RE) || []) if (!allowed.has(normNum(n))) p.push(`"${n}" in "${t.trim().slice(0, 60)}" is not in the data or the source`);
      }
    }
    add(5, 'No number the input did not give', p);
  }
  // 6. No em or en dashes outside quoted source text.
  {
    const p = [];
    for (const { t, f } of visible) if (!f.verbatim && /[–—]/.test(t)) p.push(`dash in "${t.trim().slice(0, 60)}"`);
    for (const r of rules) for (const d of r.decls) if (d.prop === 'content' && /[–—]|\\201[34]/.test(d.value)) p.push(`${r.selector}: dash in content`);
    add(6, 'No em or en dashes in the page copy', p);
  }
  // 7. Both themes, with the same tokens.
  {
    const p = [];
    const { light, darkMedia, darkAttr } = themes(rules);
    const colorKeys = (o) => Object.keys(o).filter((k) => k.startsWith('--color-')).sort();
    if (!colorKeys(light).length) p.push('no light colour tokens on :root');
    if (!colorKeys(darkMedia).length) p.push('no dark tokens under @media (prefers-color-scheme: dark)');
    if (!colorKeys(darkAttr).length) p.push('no dark tokens under :root[data-theme="dark"]');
    const missing = colorKeys(light).filter((k) => !(k in darkAttr) && !/accent$/.test(k) && k !== '--color-accent');
    if (missing.length) p.push(`dark theme lacks ${missing.join(', ')}`);
    if (JSON.stringify(darkMedia) !== JSON.stringify(Object.fromEntries(Object.entries(darkAttr).filter(([k]) => k in darkMedia)))) p.push('the two dark token blocks differ');
    add(7, 'Light and dark themes both defined', p);
  }
  // 8. Phone width.
  {
    const p = [];
    if (!/<meta[^>]+name="viewport"[^>]+width=device-width/i.test(html)) p.push('no viewport meta with width=device-width');
    for (const r of rules) {
      if (r.media) continue;
      for (const d of r.decls) {
        if (!/^(min-)?width$/.test(d.prop)) continue;
        const px = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(d.value);
        if (px && (px[2] === 'px' ? +px[1] : +px[1] * 16) > 320) p.push(`${r.selector}: ${d.prop}: ${d.value} is wider than a phone`);
      }
    }
    const tables = (html.match(/<table\b/gi) || []).length;
    const wrapped = (html.match(/class="table-wrap"[^>]*>\s*<table\b/gi) || []).length;
    if (tables !== wrapped) p.push(`${tables - wrapped} table(s) outside a scroll container`);
    add(8, 'Fits a 320px phone', p);
  }
  // 9. No horizontal page scroll.
  {
    const p = [];
    const clipped = (sel) => rules.some((r) => !r.media && r.selector.split(',').map((s) => s.trim()).includes(sel) && r.decls.some((d) => d.prop === 'overflow-x' && d.value === 'clip'));
    if (!clipped('html')) p.push('html lacks overflow-x: clip');
    if (!clipped('body')) p.push('body lacks overflow-x: clip');
    if (/100vw/.test(css)) p.push('a 100vw width');
    add(9, 'No horizontal scroll', p);
  }
  // 10. Nothing hidden behind script.
  {
    const p = [];
    const mainText = /<main\b[\s\S]*?<\/main>/i.exec(html);
    if (!mainText || !mainText[0].replace(/<[^>]+>/g, '').trim()) p.push('<main> is empty in the HTML');
    if (/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/.test(scripts)) p.push('the script writes markup; content must be in the HTML');
    for (const r of rules) {
      if (r.selector.trim().startsWith('.js ') || r.media.includes('print')) continue;
      for (const d of r.decls) if ((d.prop === 'opacity' && /^0(\.0+)?$/.test(d.value)) || (d.prop === 'visibility' && d.value === 'hidden')) p.push(`${r.selector} hides content at rest`);
    }
    for (const t of tags) if (t.f.hidden && /\bdata-(item|row)\b/.test(t.attrs)) p.push(`a data item sits inside a hidden element`);
    add(10, 'Visible without script', p);
  }
  // Security: offline and free of credit or tracking.
  {
    const p = [];
    for (const t of tags) {
      const a = /\s(src|href|action|poster|data)\s*=\s*"([^"]*)"/gi;
      let m;
      while ((m = a.exec(t.attrs))) if (/^(https?:)?\/\//i.test(m[2]) && t.name !== 'a') p.push(`<${t.name} ${m[1]}> loads ${m[2].slice(0, 60)}`);
    }
    if (/@import|url\(\s*["']?(https?:)?\/\//i.test(css)) p.push('the stylesheet loads something from the network');
    if (/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/.test(scripts) && !/fetch\(endpoint|fetch\(versionUrl/.test(scripts)) p.push('the script makes a network request');
    add('S1', 'Works offline: nothing loads from the network', p);
  }
  {
    const p = [];
    const all = visible.map((x) => x.t).join(' ');
    if (/intelligent-ui-anything|induscore/i.test(all)) p.push('the page names the tool or its maker');
    if (/[?&](utm_[a-z]+|ref)=/i.test(html)) p.push('a tracking parameter in a link');
    if (/<meta[^>]+name="generator"/i.test(html)) p.push('a generator meta tag');
    add('S2', 'No credit, no tracking', p);
  }
  return results;
}

module.exports = { check, walk, parseCss };
