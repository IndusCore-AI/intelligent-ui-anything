# The five shapes

Every input is one JSON object:

| Field | Required | What it is |
| --- | --- | --- |
| `shape` | yes | `compare`, `choose`, `explain`, `track` or `inspect` |
| `subject` | yes | the page title, a few words, plain |
| `question` | no, but give it | the one question the page answers, shown under the title |
| `summary` | no | one or two sentences of context |
| `source` | no | where the data came from, shown in the footer ("Hugging Face model cards, read today") |
| `locale` | no | BCP 47 tag such as `en-US`, `zh-CN`, `ja-JP`; number and date formats, finance colours |
| `finance` | no | `red-up` or `green-up`, to override the locale's finance convention |
| `id` | no | stable file name; use it when you re-render the same page (`track`) |
| `data` | yes | the shape's own fields, below |

Text fields accept a small Markdown subset where noted (`**bold**`, `*italic*`, `` `code` ``, `[text](https://...)`, lists). Raw HTML is always escaped. `null` or a missing value shows as "not given": never fill a gap with a guess.

## compare: a sortable matrix

For several things with the same attributes. Optional bar chart for one measure; optional pick per row.

| `data` field | What it is |
| --- | --- |
| `rows` | list of objects, one per thing compared (required) |
| `columns` | list of `{key, label, type, unit, better, best_label, max}` in display order; omit to use every key of the rows. The first column names each row |
| `columns[].type` | `text`, `number`, `rating` (needs `max`), `tag` (a pill; a list makes several), `link` (`{text, href}` or a URL), `change` (signed finance change), or a meaning: `five-elements`, `severity`, `status`, `diff`. Omitted: inferred |
| `columns[].better` | `higher` or `lower`: the best value gets a green check pill, the column sorts that way first, and the column joins the leaders strip at the top |
| `columns[].best_label` | the leaders-strip caption for that column, when "Highest GenEval" or "Lowest Weights" reads badly (for example `"Smallest download"`) |
| `highlights` | `false` hides the leaders strip. It shows the best value of up to three `better` columns and who holds it; it needs three rows or more |
| `chart` | `{value, label, title, unit, color}`: horizontal bars for the numeric column `value`. Bars are one neutral colour unless `color` names a column with a meaning, or a `five-elements` column exists |
| `pick` | `true` or `{prompt, verb, header, note}`: each row gets a radio and the whole row is tappable; `prompt` is the line the agent gets, with `{key}` filled from the row (default `"Use {first column}"`) |
| `notes` | lines shown under the table (method, caveats) |

```json
{
  "shape": "compare",
  "subject": "Packages with breaking changes",
  "question": "Which ones do we upgrade this week?",
  "source": "npm outdated and each changelog, read in this session",
  "data": {
    "columns": [
      { "key": "name", "label": "Package" },
      { "key": "from", "label": "Now" },
      { "key": "to", "label": "Latest" },
      { "key": "risk", "label": "Risk", "type": "severity" },
      { "key": "files", "label": "Files touched", "better": "lower" }
    ],
    "rows": [
      { "name": "react-router", "from": "6.28.0", "to": "7.1.1", "risk": "high", "files": 23 },
      { "name": "zod", "from": "3.23.8", "to": "3.24.1", "risk": "low", "files": 0 }
    ],
    "pick": { "prompt": "Upgrade {name} to {to} now", "verb": "Upgrade" }
  }
}
```

## choose: options with one pick

For two to six options. Each card shows the option's summary, facts, what is good and what to watch; one is picked.

| `data` field | What it is |
| --- | --- |
| `options` | list of `{title, summary, facts, pros, cons, recommended, why, prompt}` (at least two) |
| `options[].facts` | object or list of `{label, value}`: short comparable facts ("Time": "10 min") |
| `options[].recommended` | `true` on at most one; `why` says why in one sentence |
| `prompt` | the line the agent gets, `{title}` and any option key filled (default `"Go with {title}"`); an option's own `prompt` wins |
| `verb` | the button text (default "Choose this") |
| `note` | `false` hides the "Add a note" field |

```json
{
  "shape": "choose",
  "subject": "How to land the auth branch",
  "question": "Which way should the branch land?",
  "data": {
    "options": [
      { "title": "Rebase onto main", "summary": "One straight line of history.", "pros": ["Clean log"], "cons": ["Rewrites 14 commits"], "recommended": true, "why": "Nobody else has pulled the branch." },
      { "title": "Merge main in", "summary": "Keeps every commit as written.", "cons": ["A merge commit in the log"] }
    ],
    "prompt": "Land the branch: {title}"
  }
}
```

## explain: a document with a what-changed view

For a long text the user should navigate (a spec, a contract, a policy, a README), and for two versions of one. Contents on the side, an anchor on every heading, a "What changed" list, and a switch to show only changed sections.

| `data` field | What it is |
| --- | --- |
| `sections` | list of `{title, body, id, change, note, was}` (required) |
| `sections[].body` | the section's text, Markdown subset |
| `sections[].change` | `added`, `changed` or `removed` |
| `sections[].note` | one line saying what changed and why |
| `sections[].was` | the earlier wording, shown under "Earlier wording" |
| `verbatim` | `true` when the bodies quote a source word for word; the copy rules (dashes, buzzwords) then skip them |

Long PDFs: extract the text first, keep the document's own headings as sections, and summarise nothing you present as the document's words.

## track: a checklist that fills while you work

For a task with steps whose status changes. Render it once at the start, then again (same `id`) whenever a step changes; the open page reloads itself every few seconds while `live` is true.

| `data` field | What it is |
| --- | --- |
| `items` | list of `{title, status, note, at, group}` (required) |
| `items[].status` | `done`, `running`, `waiting`, `failed`, `skipped` or `warning` (synonyms such as `pending` and `todo` work) |
| `items[].at` | a time or short stamp you observed ("10:02") |
| `items[].group` | groups items under a heading, in first-seen order |
| `live` | default true while any item is running or waiting; set `false` on the last render |
| `refresh_seconds` | how often a local file reloads, 2 to 60, default 5 |

Re-renders do not open a new tab while the page is live. Over `--serve`, the page reloads only when the file changes.

## inspect: a filterable timeline or diff

For many findings, changes or events: a post-session review, an incident timeline, a code review, a log. Items sit in lanes; the user filters by lane, severity, session and text, opens diffs, and decides open items.

| `data` field | What it is |
| --- | --- |
| `items` | list of `{lane, title, detail, at, source, severity, files, diff, options}` (required) |
| `lanes` | lane keys in order, or `{key, label}`; `changed`, `risky`, `undecided`, `done` and `open` have labels built in ("What changed") |
| `items[].detail` | Markdown subset |
| `items[].source` | the session, service or author it came from; a filter appears when there are two or more |
| `items[].severity` | `critical`, `high`, `medium`, `low` or `info` |
| `items[].diff` | unified diff text; added and removed lines are marked |
| `items[].options` | for an open item: labels, or `{label, prompt}`; the user picks one per item and every pick joins one reply |
| `source_label` | what to call `source` in the page (default "Session") |
| `prompt_head` | first line of the combined reply (default "My decisions:") |

The post-session review, for several terminal sessions:

```json
{
  "shape": "inspect",
  "subject": "Three sessions, one review",
  "question": "What changed, what is risky, what is undecided?",
  "data": {
    "lanes": ["changed", "risky", "undecided"],
    "items": [
      { "lane": "changed", "title": "Retry added to the uploader", "source": "api", "files": ["src/upload.ts"], "diff": "@@ -40,2 +40,3 @@\n-send(body)\n+await retry(() => send(body), 3)\n" },
      { "lane": "risky", "title": "Retries can double-charge", "severity": "high", "detail": "The payment call has no idempotency key.", "source": "api" },
      { "lane": "undecided", "title": "Ship the retry before the key lands?", "source": "api", "options": ["Ship now", "Wait for the key"] }
    ]
  }
}
```
