// Dev only: renders the three examples, makes a real pick on each, and saves the README pictures.
// Not part of the skill and not run in CI. Needs Playwright from somewhere else on the machine:
//   IUA_PLAYWRIGHT=/path/to/node_modules/playwright/index.mjs node tests/screenshots.mjs
// It also checks every example at 320, 375 and 1280px wide in both themes for horizontal scroll.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.IUA_PLAYWRIGHT) {
  console.log('screenshots: set IUA_PLAYWRIGHT to a Playwright index.mjs to run this; skipped.');
  process.exit(0);
}
const { chromium } = await import(process.env.IUA_PLAYWRIGHT);
const out = mkdtempSync(join(tmpdir(), 'iua-shots-'));
const render = (name) => {
  const file = join(out, `${name}.html`);
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'render'), join(root, 'examples', `${name}.json`), '--out', file, '--target', 'path'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${name}: ${r.stdout}${r.stderr}`);
  return `file://${file}`;
};

const browser = await chromium.launch();
const shoot = async (name, { scheme, width = 1200, height = 860, act }) => {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(render(name));
  if (act) await act(page);
  await page.mouse.move(1, 1);
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(root, 'examples', `${name}.png`) });
  await ctx.close();
};

await shoot('comfyui-models', {
  scheme: 'light', height: 1180,
  act: async (p) => { await p.click('tbody tr:has-text("FLUX.2 [klein] 4B") label.choice'); },
});
await shoot('five-elements', { scheme: 'dark', height: 900 });
await shoot('post-session-review', {
  scheme: 'light', height: 1000,
  act: async (p) => {
    await p.click('label.choice:has-text("Two-round check")');
    await p.click('label.choice:has-text("Add it now")');
    await p.locator('#lane-undecided').scrollIntoViewIfNeeded();
    await p.evaluate(() => document.querySelector('#lane-undecided').scrollIntoView({ block: 'start' }));
  },
});

const problems = [];
for (const name of ['comfyui-models', 'five-elements', 'post-session-review']) {
  for (const width of [320, 375, 1280]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(render(name));
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      if (sw > width) problems.push(`${name} ${width}px ${scheme}: scrollWidth ${sw}`);
      if (errors.length) problems.push(`${name} ${width}px ${scheme}: ${errors.join('; ')}`);
      await ctx.close();
    }
  }
}
await browser.close();
console.log(problems.length ? `screenshots: problems\n${problems.join('\n')}` : 'screenshots: saved 3 pictures; no horizontal scroll and no script errors at 320, 375 and 1280px in either theme.');
process.exitCode = problems.length ? 1 : 0;
