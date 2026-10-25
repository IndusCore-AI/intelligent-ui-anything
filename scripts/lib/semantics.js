'use strict';
// The semantic layer: which colour a value means. The theme never changes; only the meaning of a mark does.
// Each palette maps a value (in English, Chinese, Korean or Japanese where the culture has a word) to a key.
// The key becomes a class (sem-<key>) whose --mark token lives in assets/theme.css for both themes.
// Text never wears these colours: a swatch or bar carries the colour, the words stay in ink.

const PALETTES = {
  'five-elements': {
    label: 'Five elements',
    keys: {
      wood: ['wood', '木', '목', 'moku', 'mu'],
      fire: ['fire', '火', '화', 'hi', 'ka', 'huo'],
      earth: ['earth', '土', '토', 'tsuchi', 'do', 'tu'],
      metal: ['metal', '金', '금', 'kin', 'gold', 'jin'],
      water: ['water', '水', '수', 'mizu', 'sui', 'shui'],
    },
  },
  severity: {
    label: 'Severity',
    keys: {
      critical: ['critical', 'blocker', 'p0', 'sev0', 'sev1', 'urgent'],
      high: ['high', 'major', 'p1', 'sev2', 'error'],
      medium: ['medium', 'moderate', 'p2', 'sev3', 'warning', 'warn'],
      low: ['low', 'minor', 'p3', 'sev4'],
      info: ['info', 'note', 'trivial', 'p4', 'none'],
    },
  },
  status: {
    label: 'Status',
    keys: {
      pass: ['pass', 'passed', 'ok', 'done', 'success', 'succeeded', 'green', 'yes', 'complete', 'completed', 'merged', 'shipped'],
      fail: ['fail', 'failed', 'failure', 'error', 'broken', 'red', 'no', 'blocked'],
      warn: ['warn', 'warning', 'flaky', 'partial', 'degraded', 'at risk'],
      running: ['running', 'in progress', 'active', 'working', 'started'],
      waiting: ['waiting', 'pending', 'queued', 'todo', 'to do', 'not started'],
      skip: ['skip', 'skipped', 'n/a', 'cancelled', 'canceled', 'ignored'],
    },
  },
  diff: {
    label: 'Change',
    keys: {
      added: ['added', 'add', 'new', 'created', 'insert', 'inserted'],
      removed: ['removed', 'remove', 'deleted', 'delete', 'dropped'],
      changed: ['changed', 'modified', 'updated', 'edited', 'renamed', 'moved'],
    },
  },
};

const LOOKUP = {};
for (const [palette, def] of Object.entries(PALETTES)) {
  for (const [key, words] of Object.entries(def.keys)) {
    for (const w of [key, ...words]) (LOOKUP[w.toLowerCase()] ||= []).push({ palette, key });
  }
}

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

// The semantic key for one value in one palette, or null.
function keyFor(palette, value) {
  const hits = LOOKUP[norm(value)] || [];
  const hit = hits.find((h) => h.palette === palette);
  return hit ? hit.key : null;
}

// Guess a palette for a column from its name and values: it applies only when every non-empty value maps.
function detect(values, name = '') {
  const vals = values.map(norm).filter(Boolean);
  if (!vals.length) return null;
  const n = norm(name);
  const order = /element|ohaeng|wuxing|五行|오행/.test(n) ? ['five-elements', 'status', 'severity', 'diff']
    : /sever|priority|risk|impact/.test(n) ? ['severity', 'status', 'diff', 'five-elements']
      : /change|diff/.test(n) ? ['diff', 'status', 'severity', 'five-elements']
        : ['status', 'severity', 'diff', 'five-elements'];
  for (const palette of order) {
    if (palette === 'five-elements' && !/element|ohaeng|wuxing|五行|오행/.test(n) && !vals.every((v) => /[木火土金水목화토금수]/.test(v) || PALETTES['five-elements'].keys[v])) continue;
    if (vals.every((v) => keyFor(palette, v))) return palette;
  }
  return null;
}

// Finance: which way red points. Sources and confidence are in references/semantics.md.
// red-up: mainland China, Taiwan, Japan (Korea red up, blue down). Hong Kong and everywhere else: green up.
function financeConvention(locale) {
  const l = norm(locale).replace('_', '-');
  if (/^zh(-hans)?(-cn|-sg)?$/.test(l) || /^zh-(hant-)?tw$/.test(l) || /^zh-hans/.test(l)) return 'red-up';
  if (/^zh-(hant-)?(hk|mo)$/.test(l)) return 'green-up';
  if (/^ja(-|$)/.test(l)) return 'red-up';
  if (/^ko(-|$)/.test(l)) return 'red-up-blue-down';
  return 'green-up';
}

// A signed change becomes up, down or flat. Accepts numbers and strings such as "+3.2%" or "-14".
function direction(value) {
  if (typeof value === 'number') return value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const s = String(value || '').trim();
  if (/^[+▲↑]/.test(s)) return 'up';
  if (/^[-−▼↓]/.test(s)) return 'down';
  const n = parseFloat(s.replace(/[^\d.+-]/g, ''));
  return isFinite(n) ? (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') : 'flat';
}

module.exports = { PALETTES, keyFor, detect, financeConvention, direction };
