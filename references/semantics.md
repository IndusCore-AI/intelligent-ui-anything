# The semantic layer

One look never changes: ink on paper, system fonts, the same spacing and controls on every page, in light and dark. What changes with the subject is **meaning**. A value that means something (an element, a severity, a status, a change, money going up) gets the colour that meaning has, and the words beside it stay in ink. Chrome never uses a hue, so every colour on a page is a fact.

Rules that hold for every palette:
- A colour is never the only signal. Every swatch or bar sits beside its word (element name, severity, status) or its sign (`+3%`).
- Text never wears a data colour. The mark carries the colour; labels and values use the ink tokens.
- Bars in a chart are one neutral colour unless their rows carry an identity meaning (five elements) or the agent names a column in `chart.color`. A measure is never painted with a status it does not have.
- All tokens live in `assets/theme.css`, defined for light, for dark under `prefers-color-scheme`, and again under `:root[data-theme="dark"]` (the page's own switch, and the attribute claude.ai artifacts set).

## Palette map

How a value finds its colour: the column's `type` names the palette, or the renderer infers it when every value in a column maps to one palette. Matching ignores case and accepts the local word.

| Palette | Values (synonyms) | Token |
| --- | --- | --- |
| `five-elements` | wood (木, 목), fire (火, 화), earth (土, 토), metal (金, 금, gold), water (水, 수); "Water 水" and "水星" match too | `--color-wood` jade, `--color-fire` vermilion, `--color-earth` ochre, `--color-metal` iron to silver, `--color-water` blue |
| `severity` | critical (blocker, p0, urgent), high (major, p1, error), medium (moderate, p2, warning), low (minor, p3), info (note, p4, none) | red, orange, amber, blue, grey |
| `status` | pass (done, ok, success, merged, shipped), fail (failed, error, broken, blocked), warn (flaky, partial, at risk), running (in progress, active), waiting (pending, queued, todo), skip (skipped, n/a, cancelled) | green, red, amber, blue, grey hollow, grey |
| `diff` | added (new, created), removed (deleted, dropped), changed (modified, updated, renamed) | green, red, amber; diff lines get a wash, not a hue |
| `change` (finance) | a signed number or string: `+3.2%`, `-14`, `0` | up and down by locale, below |

### Five elements

Traditional colours: wood green (青, the blue-green of jade), fire red, earth yellow (土黄, ochre), metal white, water black or blue. Two adjustments, both forced by contrast:
- **Metal** is iron grey on light paper and silver on dark. White cannot show on white paper, and gold would sit beside earth's ochre.
- **Water** is blue, the modern convention, because black is the page's ink.

Measured with the dataviz palette validator (`validate_palette.js`, Machado 2009 simulation, all pairs, because any two elements can sit side by side after a sort):

| Check | Light | Dark |
| --- | --- | --- |
| Colour-blind separation (protan and deutan, worst pair) | ΔE 8.8, target 8 met | ΔE 8.6, target 8 met |
| Normal-vision separation (worst pair) | ΔE 17.4, floor 15 met | ΔE 15.3, floor 15 met |
| Lightness band | inside | inside |
| Chroma floor | metal is under it on purpose | metal is under it on purpose |

Metal reads grey because metal means white; its name is printed on every mark, so no reader depends on the hue.

### Severity and status

These are status palettes: a small fixed scale of reserved meanings that always ship with their word. Three warm steps (critical red, high orange, medium amber) cannot also hold 3:1 contrast on light paper and stay far apart; the validator measures high against medium at ΔE 8.0 (light) and 10.4 (dark). The label beside every swatch carries the meaning, as the dataviz status rule requires.

### Finance: which way red points

| Locale | Up | Down | Confidence |
| --- | --- | --- | --- |
| zh-CN, zh-Hans, zh-SG, zh-TW | red | green | well established for mainland China and Taiwan |
| ja | red | green | reported by Benzinga as the official convention; Japanese sites vary |
| ko | red | blue | one old data point (Korean Yahoo, 2005); override with `"finance"` if unsure |
| zh-HK, zh-MO | green | red | Hong Kong follows the Western convention |
| everything else | green | red | US and European convention |

Set `"finance": "red-up"` or `"green-up"` in the input to override. Sources, read 2026-10-25: [Benzinga](https://www.benzinga.com/general/education/21/10/23258001/did-you-know-you-dont-want-to-be-in-the-green-if-youre-trading-in-china-japan-or-taiwan), [Behavioral Economics, "When red means go"](https://behavioraleconomics.com/when-red-means-go), [W3C www-international thread, 2005](https://lists.w3.org/Archives/Public/www-international/2005JulSep/0188.html).

## Contrast, measured from the tokens

`scripts/check` recomputes these on every page (WCAG 2 ratio). Marks need 3:1 on every surface; text needs 4.5:1.

| Token | Light hex | On paper / well | Dark hex | On paper / well |
| --- | --- | --- | --- | --- |
| wood | #1f9971 | 3.43 / 3.16 | #007b54 | 3.47 / 3.14 |
| fire | #c12000 | 5.82 / 5.36 | #d33500 | 3.76 / 3.40 |
| earth | #c07c00 | 3.30 / 3.04 | #c78200 | 5.80 / 5.24 |
| metal | #5b5852 | 6.85 / 6.31 | #858a8f | 5.28 / 4.77 |
| water | #0f74c5 | 4.66 / 4.30 | #366bc4 | 3.59 / 3.24 |
| red | #c92420 | 5.38 / 4.96 | #f0584b | 5.44 / 4.91 |
| orange | #cc5900 | 4.03 / 3.72 | #ef852e | 7.10 / 6.41 |
| amber | #c07c00 | 3.30 / 3.04 | #e7b643 | 9.80 / 8.85 |
| green | #298646 | 4.39 / 4.05 | #4cb86a | 7.34 / 6.63 |
| blue | #266ec3 | 4.91 / 4.52 | #5aa3ec | 6.94 / 6.27 |
| grey | #767b80 | 4.11 / 3.79 | #888d92 | 5.49 / 4.96 |

Text: ink 16.2:1 light and 16.0:1 dark on paper; secondary ink 8.8 and 10.6; muted 5.8 and 7.5. Focus ring 16.2 and 16.0. Field edges 3.5 and 4.3. Ink on the diff washes 14.3 or more.

## Component map

What each shape is made of, and where meaning shows up.

| Shape | Components | Meaning appears as |
| --- | --- | --- |
| compare | page head, bar chart (optional), filter field and row count, sortable table in its own scroller with the naming column pinned on phones, pick buttons, decision bar | swatch before a semantic cell, coloured bars for identity palettes, "highest" or "lowest" under the best value, rating meter |
| choose | page head, option cards (title, recommendation sentence, summary, facts list, good and watch-out lists), radio pick, decision bar with an optional note | none by default; the recommendation is a sentence, not a badge |
| explain | page head, contents (sticky on wide screens, folded on phones), "What changed" list, whole or changed-only switch, sections with anchors, "Earlier wording" | added, changed, removed chips with a swatch |
| track | page head, progress line and meter, live line with a pause button, grouped checklist | status swatch: filled when done, hollow while waiting |
| inspect | page head, toolbar (text filter, lane chips, severity chips, session select, count), lanes with timelines, diffs, decision groups, decision bar | severity tag, diff line washes |

Every shape: a light, auto, dark switch; a footer with the source and the time it was generated; focus rings on every control; 44px hit targets; no motion beyond a 120ms press, with a reduced-motion fallback.
