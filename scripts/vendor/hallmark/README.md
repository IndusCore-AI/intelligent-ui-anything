# Vendored: Hallmark's sloplint

`sloplint.mjs` is Hallmark's mechanical design checker, copied unchanged.

- Upstream: https://github.com/Nutlope/hallmark, file `skills/hallmark/scripts/sloplint.mjs`
- Commit: `7ec8682` (2026-10-22, "Site: the social card's pages sit higher, with room under them"), still the upstream head when copied on 2026-10-25
- Git blob of the copy: `9916fa07286e58d319528ad7cfe4ad94318e5796`, identical to the upstream blob at that commit
- Licence: MIT, copyright (c) 2026 Hallmark contributors, in `LICENSE` here (blob `f4bfc53`, identical to upstream)

## How this repo uses it

`scripts/check` runs it as `node sloplint.mjs <page> --scope app --json` on each rendered page, with quoted source text masked, and drops one gate:

- Gate 20, the Hallmark stamp: a CSS comment naming Hallmark that it asks every page to carry. The pages this skill writes carry no credit of any kind, so the gate does not apply.

Every other gate at app scope counts. A page passes with no FAIL and no REFLEX.

## What was not copied

- `sloplint-render.mjs` (the render tier): it needs puppeteer and a browser. `scripts/check` never passes `--render`, `--url`, `--before` or `--kept`, so `sloplint.mjs` never loads it, and it writes no files on the runs this repo makes.
- The rest of Hallmark (themes, references, `theme.mjs`, installers): this skill has one locked theme.

## Updating

1. Fetch the new `skills/hallmark/scripts/sloplint.mjs` at a named commit and read the diff in full.
2. Check its imports are still Node built-ins only and that it still makes no network request.
3. Run `node tests/run` and `node scripts/check --templates`; a renamed or new gate shows up there.
4. Update the commit and blob above.
