// Luvani review driver: one persistent headless Chrome per agent profile, driven step by step.
// For a plain "capture this URL in these views" run, use capture.mjs (npm run shots) instead.
//
//   node scripts/shots/lv.mjs start --agent 3 --profile main --port 9231 [--mic cafe_correct|deny|none] [--view phone|small|desktop|WxH] [--scheme light|dark] [--motion reduce]
//   node scripts/shots/lv.mjs run   --port 9231 step.mjs      # step.mjs: export default async ({ page, context, shot, text, log, sleep }) => {...}
//   node scripts/shots/lv.mjs eval  --port 9231 "await page.goto('http://localhost:8082')"   # quick one-liners, same helpers in scope
//   node scripts/shots/lv.mjs stop  --port 9231
//
// Output lives under LUVANI_SHOTS_DIR (default <tmpdir>/luvani-shots): agentN/shots, agentN/log.md,
// agentN/profiles/<profile>. A profile keeps its browser storage on disk, so stopping and starting
// again with the same --profile is "coming back later". Fake-mic clips are LUVANI_SHOTS_CLIPS
// (default <LUVANI_SHOTS_DIR>/clips) /<name>.wav. Changing --mic needs a restart because Chrome
// reads the fake microphone file at launch. Each WAV loops.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromiumPath } from './browserPath.mjs';

const ROOT = resolve(process.env.LUVANI_SHOTS_DIR ?? join(tmpdir(), 'luvani-shots'));
const CLIPS = resolve(process.env.LUVANI_SHOTS_CLIPS ?? join(ROOT, 'clips'));
const VIEWS = { phone: [375, 812], small: [320, 640], desktop: [1280, 800] };

const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opt[rest[i].slice(2)] = rest[i + 1], i++;
  else positional.push(rest[i]);
}
const port = Number(opt.port);
const metaPath = (p) => join(ROOT, `.browser-${p}.json`);

if (cmd === 'start') {
  if (!opt.agent || !port) throw new Error('start needs --agent and --port');
  const profileDir = join(ROOT, `agent${opt.agent}`, 'profiles', opt.profile ?? 'main');
  mkdirSync(profileDir, { recursive: true });
  mkdirSync(join(ROOT, `agent${opt.agent}`, 'shots'), { recursive: true });
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
    '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'];
  const mic = opt.mic ?? 'none';
  if (mic === 'deny') args.push('--deny-permission-prompts');
  else if (mic !== 'none') {
    const wav = join(CLIPS, `${mic}.wav`);
    if (!existsSync(wav)) throw new Error(`no fake-mic clip ${wav}. Put ${mic}.wav there or set LUVANI_SHOTS_CLIPS to the folder that has it.`);
    args.push('--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`);
  }
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '_daemon', profileDir, String(port), JSON.stringify(args.filter((a) => a !== '--headless=new' && !a.startsWith('--user-data-dir')))],
    { detached: true, stdio: 'ignore', env: process.env });
  child.unref();
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(metaPath(port), JSON.stringify({ agent: opt.agent, profile: opt.profile ?? 'main', mic,
    view: opt.view ?? 'phone', scheme: opt.scheme ?? 'light', motion: opt.motion ?? 'no-preference', pid: child.pid }));
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try { const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); await b.close(); break; } catch {}
  }
  console.log(`started agent${opt.agent}/${opt.profile ?? 'main'} on ${port} mic=${mic} view=${opt.view ?? 'phone'} scheme=${opt.scheme ?? 'light'}`);
} else if (cmd === '_daemon') {
  // Playwright must own the launch: Chrome only plays the fake microphone file that way.
  const [profileDir, , argsJson] = positional;
  const ctx = await chromium.launchPersistentContext(profileDir, { executablePath: chromiumPath(chromium), headless: true, args: JSON.parse(argsJson), viewport: null });
  ctx.on('close', () => process.exit(0));
  setInterval(() => {}, 1 << 30);
} else if (cmd === 'stop') {
  const meta = JSON.parse(readFileSync(metaPath(port), 'utf8'));
  try { const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); await b.close(); } catch {}
  try { process.kill(meta.pid); } catch {}
  console.log(`stopped ${port}`);
} else if (cmd === 'run' || cmd === 'eval') {
  const meta = JSON.parse(readFileSync(metaPath(port), 'utf8'));
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] ?? await context.newPage();
  const [w, h] = VIEWS[meta.view] ?? meta.view.split('x').map(Number);
  await page.setViewportSize({ width: w, height: h });
  await page.emulateMedia({ colorScheme: meta.scheme, reducedMotion: meta.motion });
  const agentDir = join(ROOT, `agent${meta.agent}`);
  mkdirSync(join(agentDir, 'shots'), { recursive: true });
  const consoleLines = [];
  page.on('console', (m) => consoleLines.push(`[console.${m.type()}] ${m.text()}`.slice(0, 400)));
  page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${String(e).slice(0, 400)}`));
  const helpers = {
    page, context, browser,
    shot: async (label, o = {}) => {
      const file = join(agentDir, 'shots', `${new Date().toISOString().slice(11, 19).replace(/:/g, '')}-${label}.png`);
      await page.screenshot({ path: file, fullPage: !!o.full });
      console.log(`shot: ${file}`);
      return file;
    },
    text: async () => (await page.innerText('body')).slice(0, 6000),
    log: (line) => appendFileSync(join(agentDir, 'log.md'), `- ${new Date().toISOString().slice(11, 19)} ${line}\n`),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
  try {
    if (cmd === 'run') {
      const mod = await import(pathToFileURL(resolve(positional[0])).href + `?t=${Date.now()}`);
      const out = await mod.default(helpers);
      if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } else {
      const fn = new Function(...Object.keys(helpers), `return (async () => { ${positional.join(' ')} })()`);
      const out = await fn(...Object.values(helpers));
      if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    }
  } finally {
    await page.waitForTimeout(300);
    if (consoleLines.length) console.log(consoleLines.filter((l) => !/Download the React DevTools|\[HMR\]/.test(l)).slice(-15).join('\n'));
    // Disconnect only; the browser keeps running with its state.
    await browser.close().catch(() => {});
  }
} else {
  console.log('usage: start | run | eval | stop (see header)');
}
