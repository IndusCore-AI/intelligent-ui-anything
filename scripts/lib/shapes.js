'use strict';
// The five shapes. Each takes the agent's JSON, checks it, and returns the view a template fills.
// No shape invents a number: every figure printed is the agent's own value or a count of the agent's items.
const { esc, typo, inline, blocks, fmtNumber, slug } = require('./text');
const sem = require('./semantics');

const SHAPES = ['compare', 'choose', 'explain', 'track', 'inspect'];

class InputError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (v == null ? '' : Array.isArray(v) ? v.map(str).join(', ') : isObj(v) ? (v.text || v.label || v.value || '') + '' : String(v));
const titleCase = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const isBlank = (v) => v == null || v === '' || (Array.isArray(v) && !v.length);
const numeric = (v) => (typeof v === 'number' && isFinite(v)) || (typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v));

// "{name} at {vram_gb} GB" filled from one record. Unknown keys stay as written so nothing is guessed.
function fill(template, record) {
  return String(template).replace(/\{([\w.-]+)\}/g, (m, k) => (record && record[k] != null ? str(record[k]) : m));
}

function need(problems, cond, msg) { if (!cond) problems.push(msg); }

// ---------- compare ----------
function compare(input, ctx) {
  const d = input.data || {};
  const problems = [];
  need(problems, Array.isArray(d.rows) && d.rows.length > 0, 'data.rows must be a non-empty list of objects, one per thing compared');
  if (problems.length) throw new InputError(problems);
  d.rows.forEach((r, i) => need(problems, isObj(r), `data.rows[${i}] must be an object such as {"name": "...", "quality": 4}`));
  if (problems.length) throw new InputError(problems);

  const keys = [];
  for (const r of d.rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k);
  const colsIn = Array.isArray(d.columns) && d.columns.length ? d.columns.map((c) => (typeof c === 'string' ? { key: c } : c)) : keys.map((k) => ({ key: k }));
  colsIn.forEach((c, i) => need(problems, isObj(c) && c.key, `data.columns[${i}] needs a "key" that names a field in each row`));
  if (problems.length) throw new InputError(problems);

  const columns = colsIn.map((c, index) => {
    const values = d.rows.map((r) => r[c.key]);
    let type = c.type;
    let palette = c.semantic || null;
    if (!type) {
      const present = values.filter((v) => !isBlank(v));
      if (palette) type = 'semantic';
      else if (present.length && present.every(numeric)) type = 'number';
      else if ((palette = sem.detect(present.map(str), `${c.key} ${c.label || ''}`))) type = 'semantic';
      else type = 'text';
    }
    if (type === 'semantic' && !palette) palette = sem.detect(values.map(str), `${c.key} ${c.label || ''}`) || 'status';
    if (['five-elements', 'severity', 'status', 'diff'].includes(type)) { palette = type; type = 'semantic'; }
    if (type === 'rating') need(problems, numeric(c.max), `data.columns[${index}] ("${c.key}") is a rating, so it needs "max", for example "max": 5`);
    const better = c.better === 'higher' || c.better === 'lower' ? c.better : null;
    let best = null;
    if (better && (type === 'number' || type === 'rating')) {
      const nums = values.filter(numeric).map(Number);
      if (nums.length > 1) best = better === 'higher' ? Math.max(...nums) : Math.min(...nums);
    }
    const align = type === 'number' || type === 'rating' || type === 'change' ? 'num' : '';
    return {
      index, key: c.key, label: c.label || titleCase(String(c.key).replace(/_/g, ' ')), unit: c.unit || '', type, palette,
      max: c.max, better, best, align,
      sortType: type === 'number' || type === 'rating' || type === 'change' ? 'number' : 'text',
      firstDir: better === 'lower' ? 'ascending' : type === 'number' || type === 'rating' ? 'descending' : 'ascending',
    };
  });
  if (problems.length) throw new InputError(problems);

  const cell = (col, v) => {
    if (isBlank(v)) return { html: '<span class="blank">not given</span>', sort: '' };
    if (col.type === 'number') {
      const n = Number(v);
      const html = esc(numeric(v) && typeof v === 'number' ? fmtNumber(v, ctx.locale) : v) + (col.best != null && n === col.best ? `<span class="best">${col.better === 'lower' ? 'lowest' : 'highest'}</span>` : '');
      return { html, sort: numeric(v) ? String(n) : '' };
    }
    if (col.type === 'rating') {
      const n = Number(v), m = Number(col.max);
      const share = m > 0 ? Math.max(0, Math.min(1, n / m)) : 0;
      return {
        html: `<span class="rating">${esc(v)}<span class="unit">of ${esc(col.max)}</span><span class="rating-track" aria-hidden="true"><span class="rating-fill" style="--share: ${share.toFixed(3)}"></span></span></span>${col.best != null && n === col.best ? `<span class="best">${col.better === 'lower' ? 'lowest' : 'highest'}</span>` : ''}`,
        sort: numeric(v) ? String(n) : '',
      };
    }
    if (col.type === 'semantic') {
      const key = sem.keyFor(col.palette, str(v)) || 'plain';
      return { html: `<span class="cell-sem sem-${key}"><span class="swatch" aria-hidden="true"></span>${esc(str(v))}</span>`, sort: str(v) };
    }
    if (col.type === 'change') {
      const dir = sem.direction(v);
      const n = parseFloat(String(v).replace(/[^\d.+-]/g, ''));
      return { html: `<span class="cell-sem fin-${dir}"><span class="swatch" aria-hidden="true"></span>${esc(str(v))}</span>`, sort: isFinite(n) ? String(dir === 'down' ? -Math.abs(n) : n) : '' };
    }
    if (col.type === 'tag') {
      const list = Array.isArray(v) ? v : [v];
      return { html: list.map((t) => `<span class="tag">${esc(str(t))}</span>`).join(' '), sort: list.map(str).join(', ') };
    }
    if (col.type === 'link' || (isObj(v) && v.href)) {
      const href = isObj(v) ? v.href : v;
      const text = isObj(v) ? v.text || v.href : v;
      const safe = /^https?:\/\//i.test(String(href)) ? href : null;
      return { html: safe ? `<a href="${esc(safe)}" rel="noopener noreferrer">${esc(text)}</a>` : esc(text), sort: str(text) };
    }
    return { html: inline(str(v)), sort: str(v) };
  };

  const pickIn = d.pick === true ? {} : isObj(d.pick) ? d.pick : null;
  const first = columns[0];
  const rows = d.rows.map((r, i) => {
    const cells = columns.map((col, ci) => ({ ...cell(col, r[col.key]), align: col.align, head: ci === 0 }));
    const label = str(r[first.key]);
    return {
      index: i,
      text: columns.map((c) => str(r[c.key])).join(' '),
      cells,
      pickPrompt: pickIn ? fill(pickIn.prompt || `${pickIn.verb || 'Use'} {${first.key}}`, r) : '',
      pickLabel: label,
      pickVerb: pickIn ? pickIn.verb || 'Use' : '',
    };
  });

  let chart = null;
  if (d.chart) {
    const ch = isObj(d.chart) ? d.chart : { value: d.chart };
    const vcol = columns.find((c) => c.key === ch.value);
    need(problems, vcol, `data.chart.value must name a numeric column; got "${ch.value}"`);
    if (vcol) {
      const vals = d.rows.map((r) => r[vcol.key]);
      need(problems, vals.every((v) => isBlank(v) || (numeric(v) && Number(v) >= 0)), `data.chart draws bars, so "${vcol.key}" needs numbers of 0 or more in every row`);
      if (!problems.length) {
        const max = Math.max(...vals.filter(numeric).map(Number), 0);
        const lcol = columns.find((c) => c.key === (ch.label || first.key)) || first;
        // Bars take a colour only from an identity palette (five elements) or a column the agent names in "color";
        // status or severity would paint a measure with a meaning it does not have.
        const ccol = columns.find((c) => c.key === ch.color) || columns.find((c) => c.type === 'semantic' && c.palette === 'five-elements');
        chart = {
          title: ch.title || `${vcol.label}${vcol.unit ? ` (${vcol.unit})` : ''}`,
          note: ch.note || '',
          bars: d.rows.map((r) => ({
            label: str(r[lcol.key]),
            value: isBlank(r[vcol.key]) ? 'not given' : typeof r[vcol.key] === 'number' ? fmtNumber(r[vcol.key], ctx.locale) : str(r[vcol.key]),
            unit: isBlank(r[vcol.key]) ? '' : ch.unit != null ? ch.unit : vcol.unit,
            blank: isBlank(r[vcol.key]),
            share: max > 0 && numeric(r[vcol.key]) ? (Number(r[vcol.key]) / max).toFixed(4) : '0',
            sem: ccol ? `sem-${sem.keyFor(ccol.palette, str(r[ccol.key])) || 'plain'}` : 'sem-series',
          })),
        };
      }
    }
  }
  if (problems.length) throw new InputError(problems);

  return {
    columns,
    rows,
    rowCount: rows.length,
    tableLabel: d.table_label || `${input.subject}, as a table`,
    chart,
    notes: (Array.isArray(d.notes) ? d.notes : d.notes ? [d.notes] : []).map((n) => typo(str(n))),
    pick: pickIn ? { header: pickIn.header || 'Pick' } : null,
    decide: { title: 'Your pick', empty: 'Nothing picked yet. Pick a row.', head: '', note: pickIn ? pickIn.note !== false : false },
  };
}

// ---------- choose ----------
function choose(input) {
  const d = input.data || {};
  const problems = [];
  need(problems, Array.isArray(d.options) && d.options.length >= 2, 'data.options must list at least two options to choose between');
  if (problems.length) throw new InputError(problems);
  const options = d.options.map((o, i) => {
    need(problems, isObj(o) && (o.title || o.name), `data.options[${i}] needs a "title"`);
    if (!isObj(o)) return {};
    const title = str(o.title || o.name);
    let facts = o.facts;
    if (isObj(facts)) facts = Object.entries(facts).map(([label, value]) => ({ label, value }));
    facts = Array.isArray(facts) ? facts.map((f) => ({ label: str(f.label), value: typeof f.value === 'number' ? fmtNumber(f.value) : str(f.value) })) : [];
    const pros = (o.pros || o.good || []).map((x) => typo(str(x)));
    const cons = (o.cons || o.watch || o.risks || []).map((x) => typo(str(x)));
    return {
      index: i, title, summary: typo(str(o.summary || o.description)), recommended: !!o.recommended, why: typo(str(o.why || o.reason)),
      facts, hasFacts: facts.length > 0, pros, hasPros: pros.length > 0, cons, hasCons: cons.length > 0,
      prompt: fill(o.prompt || d.prompt || 'Go with {title}', { ...o, title }),
      verb: d.verb || 'Choose this',
    };
  });
  if (problems.length) throw new InputError(problems);
  return { options, decide: { title: 'Your pick', empty: 'Nothing picked yet. Choose an option.', head: '', note: d.note !== false } };
}

// ---------- explain ----------
function explain(input) {
  const d = input.data || {};
  const problems = [];
  need(problems, Array.isArray(d.sections) && d.sections.length > 0, 'data.sections must be a non-empty list of {"title", "body"}');
  if (problems.length) throw new InputError(problems);
  const used = new Set();
  const verbatim = !!d.verbatim;
  const sections = d.sections.map((s, i) => {
    need(problems, isObj(s) && s.title, `data.sections[${i}] needs a "title"`);
    if (!isObj(s)) return {};
    let id = slug(s.id || s.title, 40);
    while (used.has(id)) id += '-x';
    used.add(id);
    const change = s.change ? sem.keyFor('diff', s.change) : null;
    if (s.change) need(problems, change, `data.sections[${i}].change must be "added", "changed" or "removed"`);
    return {
      id, title: str(s.title), change, sem: change ? `sem-${change}` : '',
      changeLabel: change ? titleCase(change) : '', note: str(s.note),
      bodyHtml: blocks(s.body, verbatim), wasHtml: s.was ? blocks(s.was, verbatim) : '', verbatim,
    };
  });
  if (problems.length) throw new InputError(problems);
  const changes = sections.filter((s) => s.change).map((s) => ({ id: s.id, title: s.title, label: s.change, note: s.note, sem: s.sem }));
  return { sections, changes, hasChanges: changes.length > 0 };
}

// ---------- track ----------
const STATUS_LABEL = { pass: 'Done', fail: 'Failed', warn: 'Warning', running: 'Running', waiting: 'Waiting', skip: 'Skipped' };
function track(input, ctx) {
  const d = input.data || {};
  const problems = [];
  need(problems, Array.isArray(d.items) && d.items.length > 0, 'data.items must be a non-empty list of {"title", "status"}');
  if (problems.length) throw new InputError(problems);
  const items = d.items.map((it, i) => {
    need(problems, isObj(it) && it.title, `data.items[${i}] needs a "title"`);
    if (!isObj(it)) return {};
    const key = sem.keyFor('status', it.status || 'waiting');
    need(problems, key, `data.items[${i}].status "${it.status}" is not one of done, running, waiting, failed, skipped, warning`);
    return { title: str(it.title), note: str(it.note), at: str(it.at), group: str(it.group), statusKey: key, statusLabel: STATUS_LABEL[key] || '', sem: `sem-${key}` };
  });
  if (problems.length) throw new InputError(problems);
  const groups = [];
  for (const it of items) {
    let g = groups.find((x) => x.title === it.group);
    if (!g) groups.push((g = { title: it.group, label: it.group || 'Steps', items: [] }));
    g.items.push(it);
  }
  const done = items.filter((i) => i.statusKey === 'pass').length;
  const failed = items.filter((i) => i.statusKey === 'fail').length;
  const live = d.live != null ? !!d.live : items.some((i) => i.statusKey === 'running' || i.statusKey === 'waiting');
  return {
    groups, done, failed, total: items.length, share: (items.length ? done / items.length : 0).toFixed(4),
    live, liveSeconds: live ? String(ctx.liveSeconds) : '', updated: ctx.clock,
  };
}

// ---------- inspect ----------
const LANE_LABEL = { changed: 'What changed', risky: 'What is risky', undecided: 'What is undecided', done: 'What was done', open: 'What is open' };
const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
function diffHtml(text) {
  return String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => {
    const cls = /^@@/.test(l) ? 'd-hunk' : /^\+(?!\+\+)/.test(l) ? 'd-add' : /^-(?!--)/.test(l) ? 'd-del' : '';
    return `<span${cls ? ` class="${cls}"` : ''}>${esc(l) || ' '}</span>`;
  }).join('');
}
function inspect(input) {
  const d = input.data || {};
  const problems = [];
  need(problems, Array.isArray(d.items) && d.items.length > 0, 'data.items must be a non-empty list of {"lane", "title"}');
  if (problems.length) throw new InputError(problems);
  const lanesIn = Array.isArray(d.lanes) && d.lanes.length ? d.lanes.map((l) => (typeof l === 'string' ? { key: l } : l)) : [];
  for (const it of d.items) if (isObj(it) && it.lane && !lanesIn.find((l) => l.key === it.lane)) lanesIn.push({ key: it.lane });
  if (!lanesIn.length) lanesIn.push({ key: 'items', label: 'Items' });
  const sourceLabel = d.source_label || 'Session';
  let anyOptions = false;
  const items = d.items.map((it, i) => {
    need(problems, isObj(it) && it.title, `data.items[${i}] needs a "title"`);
    if (!isObj(it)) return {};
    const sevKey = it.severity ? sem.keyFor('severity', it.severity) : null;
    if (it.severity) need(problems, sevKey, `data.items[${i}].severity "${it.severity}" is not one of critical, high, medium, low, info`);
    const options = Array.isArray(it.options) ? it.options.map((o, oi) => {
      const label = str(isObj(o) ? o.label || o.title : o);
      return { index: oi, label, itemIndex: i, prompt: isObj(o) && o.prompt ? fill(o.prompt, it) : `${str(it.title).replace(/[:.]$/, '')}${/\?$/.test(str(it.title)) ? '' : ':'} ${label}` };
    }) : [];
    if (options.length) anyOptions = true;
    const files = Array.isArray(it.files) ? it.files.map(str) : it.files ? [str(it.files)] : [];
    return {
      lane: it.lane || lanesIn[0].key, title: str(it.title), at: str(it.at || it.time),
      detailHtml: it.detail ? blocks(it.detail) : '', source: str(it.source || it.session),
      severity: sevKey || '', severityLabel: sevKey ? titleCase(sevKey) : '', sem: sevKey ? `sem-${sevKey}` : '',
      files, hasFiles: files.length > 0, hasMeta: !!(it.source || it.session) || files.length > 0, sourceLabel,
      diffHtml: it.diff ? diffHtml(it.diff) : '', options, hasOptions: options.length > 0,
      text: [it.title, it.detail, it.source, it.session, files.join(' ')].filter(Boolean).map(str).join(' '),
    };
  });
  if (problems.length) throw new InputError(problems);
  const lanes = lanesIn.map((l) => ({ key: slug(l.key, 24), rawKey: l.key, label: l.label || LANE_LABEL[l.key] || titleCase(String(l.key)) }));
  const laneSections = lanes.map((l) => {
    const its = items.filter((it) => it.lane === l.rawKey).map((it) => ({ ...it, lane: l.key }));
    return { ...l, items: its, count: its.length, hasTime: its.some((it) => it.at), emptyText: `Nothing under ${l.label.toLowerCase()}.` };
  });
  const sevs = SEV_ORDER.filter((k) => items.some((it) => it.severity === k)).map((k) => ({ key: k, label: titleCase(k), sem: `sem-${k}` }));
  const sources = [...new Set(items.map((it) => it.source).filter(Boolean))];
  return {
    lanes, laneSections, itemCount: items.length, severities: sevs, hasSeverity: sevs.length > 1,
    sources, hasSources: sources.length > 1, sourceLabel,
    decide: anyOptions ? { title: 'Your decisions', empty: 'Nothing decided yet.', head: d.prompt_head || 'My decisions:', note: d.note !== false } : null,
  };
}

const BUILDERS = { compare, choose, explain, track, inspect };

function build(input, ctx) {
  const problems = [];
  need(problems, isObj(input), 'the input must be one JSON object: {"shape": "...", "subject": "...", "data": {...}}');
  if (problems.length) throw new InputError(problems);
  need(problems, SHAPES.includes(input.shape), `"shape" must be one of ${SHAPES.join(', ')}; got ${JSON.stringify(input.shape)}. If none fits, answer in prose instead.`);
  need(problems, typeof input.subject === 'string' && input.subject.trim(), '"subject" must name what the page is about, in a few words (it becomes the page title)');
  need(problems, isObj(input.data), '"data" must be an object; see references/shapes.md for each shape');
  if (problems.length) throw new InputError(problems);
  return BUILDERS[input.shape](input, ctx);
}

module.exports = { build, SHAPES, InputError, fill };
