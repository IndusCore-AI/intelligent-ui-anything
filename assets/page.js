/* intelligent-ui-anything page behaviour. Everything on the page is readable without this script;
   it adds sorting, filtering, the theme switch, live updates and the way a pick goes back to the agent. */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');
  var $ = function (sel, el) { return (el || doc).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(sel)); };
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage off */ } },
    sget: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage off */ } }
  };
  var meta = function (name) { var m = $('meta[name="' + name + '"]'); return m ? m.getAttribute('content') : ''; };
  var reveal = function (el) { if (el) el.hidden = false; };

  // Theme: auto follows the system; light and dark set data-theme, which the tokens read.
  var themeSwitch = $('.theme-switch');
  if (themeSwitch) {
    reveal(themeSwitch);
    var applyTheme = function (choice) {
      if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice); else root.removeAttribute('data-theme');
      $$('button', themeSwitch).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-choice') === (choice || 'auto'))); });
    };
    var saved = store.get('iua-theme');
    if (!root.hasAttribute('data-theme') && saved) applyTheme(saved);
    themeSwitch.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-theme-choice]');
      if (!b) return;
      var c = b.getAttribute('data-theme-choice');
      applyTheme(c);
      store.set('iua-theme', c);
    });
  }

  // Sorting: header buttons sort rows by each cell's data-sort value.
  $$('table[data-sortable]').forEach(function (table) {
    var tbody = table.tBodies[0];
    $$('thead .sort-btn', table).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var th = btn.closest('th');
        var idx = Number(btn.getAttribute('data-col'));
        var type = btn.getAttribute('data-type');
        var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        if (th.getAttribute('aria-sort') === 'none' && btn.getAttribute('data-first') === 'descending') dir = 'descending';
        $$('thead th', table).forEach(function (h) { if (h.hasAttribute('aria-sort')) h.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', dir);
        var rows = $$('tr', tbody);
        var val = function (tr) { var c = tr.querySelector('[data-c="' + idx + '"]'); return c ? c.getAttribute('data-sort') : ''; };
        rows.sort(function (a, b) {
          var x = val(a), y = val(b);
          var blankX = x === '' || x == null, blankY = y === '' || y == null;
          if (blankX || blankY) return blankX === blankY ? 0 : blankX ? 1 : -1;
          var r = type === 'number' ? Number(x) - Number(y) : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
          return dir === 'ascending' ? r : -r;
        });
        rows.forEach(function (tr) { tbody.appendChild(tr); });
        var live = $('[data-sort-status]');
        if (live) live.textContent = 'Sorted by ' + btn.getAttribute('data-label') + ', ' + (dir === 'ascending' ? 'low to high' : 'high to low') + '.';
      });
    });
  });

  // Filtering: a text filter plus facet chips and selects; counts are recomputed from what stays visible.
  var toolbar = $('[data-toolbar]');
  if (toolbar) {
    reveal(toolbar);
    var input = $('[data-filter]', toolbar);
    var items = $$('[data-item]');
    var facetOn = function (facet, value) {
      var chip = $('[data-facet="' + facet + '"][data-value="' + value + '"]', toolbar);
      return !chip || chip.getAttribute('aria-pressed') === 'true';
    };
    var apply = function () {
      var q = (input && input.value || '').trim().toLowerCase();
      var selects = $$('[data-facet-select]', toolbar);
      var shown = 0;
      items.forEach(function (el) {
        var ok = !q || (el.getAttribute('data-text') || el.textContent).toLowerCase().indexOf(q) !== -1;
        ['lane', 'severity'].forEach(function (f) { var v = el.getAttribute('data-' + f); if (ok && v) ok = facetOn(f, v); });
        selects.forEach(function (s) { var f = s.getAttribute('data-facet-select'); if (ok && s.value) ok = el.getAttribute('data-' + f) === s.value; });
        if (ok) { el.removeAttribute('data-filtered'); shown++; } else el.setAttribute('data-filtered', '');
        if (el.tagName === 'TR') el.hidden = !ok;
      });
      $$('[data-lane-section]').forEach(function (sec) {
        var n = $$('[data-item]:not([data-filtered])', sec).length;
        var c = $('[data-lane-count]', sec);
        if (c) c.textContent = String(n);
        if (n) sec.removeAttribute('data-empty'); else sec.setAttribute('data-empty', '');
      });
      var count = $('[data-count]');
      if (count) count.textContent = String(shown);
    };
    if (input) input.addEventListener('input', apply);
    toolbar.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-facet]');
      if (!chip) return;
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      apply();
    });
    $$('[data-facet-select]', toolbar).forEach(function (s) { s.addEventListener('change', apply); });
  }

  // Explain: whole document or changed sections only.
  var viewSwitch = $('.view-switch');
  if (viewSwitch) {
    reveal(viewSwitch);
    viewSwitch.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-view]');
      if (!b) return;
      $('.page').setAttribute('data-view', b.getAttribute('data-view'));
      $$('button', viewSwitch).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  }

  // Decide: picks become one prompt line the agent can read, by clipboard or, when served, by a local request.
  var decide = $('[data-decide]');
  if (decide) {
    var out = $('.decide-out', decide);
    var note = $('.decide-note input', decide);
    var copyBtn = $('[data-copy]', decide);
    var sendBtn = $('[data-send]', decide);
    var status = $('.decide-status', decide);
    var endpoint = meta('iua-endpoint');
    var served = endpoint && /^https?:$/.test(location.protocol) && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
    var head = decide.getAttribute('data-head') || '';
    var current = function () {
      var picks = $$('input[type="radio"][data-prompt]:checked');
      var lines = picks.map(function (p) { return p.getAttribute('data-prompt'); });
      if (!lines.length) return null;
      var text = lines.length === 1 ? lines[0] : (head ? head + '\n' : '') + lines.map(function (l) { return '- ' + l; }).join('\n');
      var n = note && note.value.trim();
      if (n) text += '\nNote: ' + n;
      return {
        prompt: text,
        picks: picks.map(function (p) { return { group: p.name, value: p.value, label: p.getAttribute('data-label') || '', prompt: p.getAttribute('data-prompt') }; }),
        note: n || ''
      };
    };
    var refresh = function () {
      var d = current();
      $$('tr[data-row]').forEach(function (tr) { var r = $('input[type="radio"]', tr); if (r && r.checked) tr.setAttribute('data-picked', ''); else tr.removeAttribute('data-picked'); });
      if (d) { out.textContent = d.prompt; out.removeAttribute('data-empty'); } else { out.textContent = out.getAttribute('data-empty-text'); out.setAttribute('data-empty', ''); }
      if (d) decide.removeAttribute('data-idle'); else decide.setAttribute('data-idle', '');
      copyBtn.disabled = !d;
      if (sendBtn) sendBtn.disabled = !d || sendBtn.getAttribute('data-state') === 'done';
      copyBtn.removeAttribute('data-state');
      restore(copyBtn);
      if (sendBtn && sendBtn.getAttribute('data-state') !== 'done') { sendBtn.removeAttribute('data-state'); restore(sendBtn); }
      status.textContent = '';
    };
    doc.addEventListener('change', function (e) {
      if (!(e.target.matches && e.target.matches('input[type="radio"][data-prompt]'))) return;
      refresh();
      // Replay the dock's settle so each new pick is felt where the line appears.
      decide.removeAttribute('data-has-pick');
      void decide.offsetWidth;
      if (current()) decide.setAttribute('data-has-pick', '');
    });
    // A whole row or option card is the target, not only its small radio.
    doc.addEventListener('click', function (e) {
      var host = e.target.closest && e.target.closest('tr[data-row], .option');
      if (!host || e.target.closest('a, button, input, label, select, summary, textarea')) return;
      var radio = $('input[type="radio"][data-prompt]', host);
      if (!radio || radio.disabled || radio.checked) return;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (note) note.addEventListener('input', refresh);
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    // Completion is said on the button itself: its words and icon change, so the result sits where the click was.
    var label = function (btn, text, icon) {
      var t = $('[data-text]', btn), u = $('use', btn);
      if (!btn.hasAttribute('data-rest')) btn.setAttribute('data-rest', t.textContent + '|' + u.getAttribute('href'));
      t.textContent = text;
      u.setAttribute('href', icon);
    };
    var restore = function (btn) {
      var rest = btn.getAttribute('data-rest');
      if (!rest) return;
      var parts = rest.split('|');
      label(btn, parts[0], parts[1]);
    };
    var selectOut = function () { var r = doc.createRange(); r.selectNodeContents(out); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
    copyBtn.addEventListener('click', function () {
      var d = current();
      if (!d) return;
      var ok = function () {
        copyBtn.setAttribute('data-state', 'done');
        label(copyBtn, 'Copied', '#i-check');
        status.textContent = 'Copied. Paste it into the agent to carry on.';
        window.setTimeout(function () { restore(copyBtn); copyBtn.removeAttribute('data-state'); }, 1800);
      };
      var fail = function () { selectOut(); copyBtn.setAttribute('data-state', 'error'); status.textContent = 'The browser blocked the clipboard. The line is selected: press ' + (mac ? 'Cmd+C' : 'Ctrl+C') + '.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.prompt).then(ok, fail); else fail();
    });
    if (sendBtn && served) {
      // Served, Send is the one-step path, so it leads; Copy stays as the fallback.
      reveal(sendBtn);
      sendBtn.classList.add('btn-primary');
      copyBtn.classList.remove('btn-primary');
      decide.querySelector('.decide-actions').insertBefore(sendBtn, copyBtn);
      sendBtn.addEventListener('click', function () {
        var d = current();
        if (!d) return;
        sendBtn.setAttribute('aria-busy', 'true');
        sendBtn.disabled = true;
        status.textContent = 'Sending to the agent.';
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: d.prompt, picks: d.picks, note: d.note, subject: doc.title, shape: $('.page').getAttribute('data-shape') }) })
          .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
          .then(function () { sendBtn.removeAttribute('aria-busy'); sendBtn.setAttribute('data-state', 'done'); label(sendBtn, 'Sent', '#i-check'); status.textContent = 'Sent. The agent has your pick; you can close this tab.'; })
          .catch(function () { sendBtn.removeAttribute('aria-busy'); sendBtn.disabled = false; sendBtn.setAttribute('data-state', 'error'); status.textContent = 'Not sent: the local server did not answer. Use Copy instead.'; });
      });
    }
    refresh();
  }

  // Live: a page the agent is still filling reloads itself until the agent marks it finished.
  var liveEvery = Number(meta('iua-live')) || 0;
  var liveBtn = $('[data-live-toggle]');
  if (liveEvery > 0) {
    var paused = store.sget('iua-paused:' + location.pathname) === '1';
    var label = function () { if (liveBtn) { liveBtn.textContent = paused ? 'Resume updates' : 'Pause updates'; liveBtn.setAttribute('aria-pressed', String(paused)); } };
    if (liveBtn) {
      reveal(liveBtn);
      label();
      liveBtn.addEventListener('click', function () { paused = !paused; store.sset('iua-paused:' + location.pathname, paused ? '1' : '0'); label(); });
    }
    var versionUrl = meta('iua-version');
    var seen = null;
    var tick = function () {
      if (paused || doc.hidden) return;
      if (versionUrl && /^https?:$/.test(location.protocol)) {
        fetch(versionUrl, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (v) {
          if (seen !== null && v !== seen) location.reload();
          seen = v;
        }).catch(function () { /* server gone: stay on the last state */ });
      } else location.reload();
    };
    window.setInterval(tick, (versionUrl && /^https?:$/.test(location.protocol) ? 2 : liveEvery) * 1000);
  }
})();
