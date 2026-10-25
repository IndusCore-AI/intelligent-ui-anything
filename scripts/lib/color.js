'use strict';
// Colour parsing and WCAG contrast for the floor check. Reads #hex, rgb(), and oklch() as theme.css writes them.

function parseColor(v) {
  const s = String(v || '').trim().toLowerCase();
  let m;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    const ch = (x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x) / 255);
    return { r: ch(p[0]), g: ch(p[1]), b: ch(p[2]), a: p[3] != null ? parseFloat(p[3]) : 1 };
  }
  if ((m = /^oklch\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s/]+/).filter(Boolean);
    const L = p[0].endsWith('%') ? parseFloat(p[0]) / 100 : parseFloat(p[0]);
    const C = parseFloat(p[1]);
    const H = (parseFloat(p[2]) || 0) * Math.PI / 180;
    const a = p[3] != null ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
    return { ...oklabToSrgb(L, C * Math.cos(H), C * Math.sin(H)), a };
  }
  return null;
}

function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  const enc = (x) => {
    const c = Math.min(1, Math.max(0, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return { r: enc(lin[0]), g: enc(lin[1]), b: enc(lin[2]) };
}

function luminance({ r, g, b }) {
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(c1, c2) {
  const a = luminance(c1), b = luminance(c2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');

// Resolve var(--x) chains inside one token map.
function resolve(value, tokens, depth = 0) {
  if (depth > 8) return value;
  const out = String(value).replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (m0, name, fb) => (tokens[name] != null ? tokens[name] : fb != null ? fb : m0));
  return out === value ? out : resolve(out, tokens, depth + 1);
}

module.exports = { parseColor, contrast, luminance, toHex, resolve };
