// One-shot screenshots of a running Luvani web build: every view x colour scheme, one command.
//
//   node scripts/shots/capture.mjs --url http://localhost:8093 --name today \
//     [--views phone,small] [--schemes light,dark] [--motion reduce] \
//     [--wait-text "Bonjour"] [--out <dir>]
//
// Writes <out>/<name>-<view>-<scheme>.png and prints each path. Views are phone (375x812),
// small (320x640), desktop (1280x800) or WxH. Out defaults to LUVANI_SHOTS_DIR/shots, and
// LUVANI_SHOTS_DIR defaults to <tmpdir>/luvani-shots. It launches a fresh headless browser each
// run (no daemon, no saved storage). For multi-step flows use lv.mjs.
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromiumPath } from './browserPath.mjs';

export const VIEWS = { phone: [375, 812], small: [320, 640], desktop: [1280, 800] };
export const SCHEMES = ['light', 'dark'];
const WAIT_TIMEOUT_MS = 30_000;
const SETTLE_MS = 1500;
const LAUNCH_SCREEN = '[aria-label="Luvani"]';
const LAUNCH_TIMEOUT_MS = 10_000;
const FADE_MS = 500;

const list = (value) => String(value).split(',').map((s) => s.trim()).filter(Boolean);

export function viewSize(view) {
  if (VIEWS[view]) return VIEWS[view];
  const m = /^(\d+)x(\d+)$/.exec(view);
  if (!m) throw new Error(`unknown view "${view}". Use ${Object.keys(VIEWS).join(', ')} or WxH like 390x844.`);
  return [Number(m[1]), Number(m[2])];
}

/** Parses argv (without node and script) into validated options. Throws a plain-sentence error. */
export function parseArgs(argv, env = process.env) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new Error(`unexpected argument "${a}"`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new Error(`--${key} needs a value`);
    flags[key] = next;
    i++;
  }
  const known = ['url', 'name', 'views', 'schemes', 'motion', 'wait-text', 'out'];
  for (const key of Object.keys(flags)) if (!known.includes(key)) throw new Error(`unknown option --${key}`);
  if (!flags.url) throw new Error('--url is required');
  if (!flags.name) throw new Error('--name is required');
  if (!/^[A-Za-z0-9._-]+$/.test(flags.name)) throw new Error('--name may only use letters, digits, dot, dash and underscore');
  const views = list(flags.views ?? 'phone,small');
  const schemes = list(flags.schemes ?? 'light,dark');
  if (!views.length) throw new Error('--views is empty');
  if (!schemes.length) throw new Error('--schemes is empty');
  views.forEach(viewSize);
  for (const s of schemes) if (!SCHEMES.includes(s)) throw new Error(`unknown scheme "${s}". Use light or dark.`);
  const motion = flags.motion ?? 'no-preference';
  if (!['reduce', 'no-preference'].includes(motion)) throw new Error('--motion must be reduce or no-preference');
  const root = resolve(env.LUVANI_SHOTS_DIR ?? join(tmpdir(), 'luvani-shots'));
  return {
    url: flags.url,
    name: flags.name,
    views,
    schemes,
    motion,
    waitText: flags['wait-text'],
    out: resolve(flags.out ?? join(root, 'shots')),
  };
}

/** The view x scheme matrix, views outer, with the file each one writes. */
export function planShots({ name, views, schemes, out }) {
  return views.flatMap((view) => schemes.map((scheme) => {
    const [width, height] = viewSize(view);
    return { view, scheme, width, height, file: join(out, `${name}-${view}-${scheme}.png`) };
  }));
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\nusage: npm run shots -- --url <url> --name <label> [--views phone,small] [--schemes light,dark] [--motion reduce] [--wait-text "<text>"] [--out <dir>]`);
    process.exit(2);
  }
  const { chromium } = await import('playwright');
  mkdirSync(options.out, { recursive: true });
  const browser = await chromium.launch({ executablePath: chromiumPath(chromium), headless: true });
  const errors = new Set();
  const warnings = [];
  let failed = false;
  try {
    for (const shot of planShots(options)) {
      const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, colorScheme: shot.scheme });
      const page = await context.newPage();
      const tag = `${shot.view}-${shot.scheme}`;
      page.on('console', (m) => { if (m.type() === 'error') errors.add(`[${tag}] ${m.text().slice(0, 300)}`); });
      page.on('pageerror', (e) => errors.add(`[${tag}] pageerror ${String(e).slice(0, 300)}`));
      await page.emulateMedia({ colorScheme: shot.scheme, reducedMotion: options.motion });
      try {
        await page.goto(options.url, { waitUntil: 'load' });
        if (options.waitText) {
          await page.waitForFunction((text) => document.body && document.body.innerText.includes(text), options.waitText, { timeout: WAIT_TIMEOUT_MS });
        } else {
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(SETTLE_MS);
        }
        // Expo web draws a launch screen over the app and fades it out. Its text is already in the
        // page, so a text wait alone can match behind it. A first-run welcome keeps it up until
        // Get Started is tapped, so a timeout here warns and shoots anyway.
        const left = await page.waitForSelector(LAUNCH_SCREEN, { state: 'detached', timeout: LAUNCH_TIMEOUT_MS }).then(() => true, () => false);
        if (left) await page.waitForTimeout(FADE_MS);
        else warnings.push(`[${tag}] the launch screen was still covering the app, so this shot may show it`);
        await page.screenshot({ path: shot.file });
        console.log(shot.file);
      } catch (error) {
        failed = true;
        const debug = shot.file.replace(/\.png$/, '-FAILED.png');
        await page.screenshot({ path: debug }).catch(() => {});
        console.error(`${tag}: ${String(error.message).split('\n')[0]} (what the page showed instead: ${debug})`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  for (const w of warnings) console.warn(w);
  if (errors.size) console.log(`\nconsole errors seen (${errors.size}):\n${[...errors].join('\n')}`);
  else console.log('\nno console errors seen');
  if (failed) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
