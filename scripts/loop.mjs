#!/usr/bin/env node
/**
 * The loop.
 *
 * A prompt answers once and stops, whether or not the answer was any good — and then it
 * is your job to check it and prompt again. This removes you from that cycle: it sets
 * Claude a goal it cannot fake, lets it work, checks the work with `npm run gate`, and if
 * the gate is still red it writes the next prompt itself, including what the last attempt
 * tried and why that did not work. It stops when the gate goes green, when it runs out of
 * budget, or when two iterations in a row fail to move the number.
 *
 *   npm run loop -- --max 10 --minutes 60
 *
 * Rules it will not break: never on `main`, never on a dirty tree, never a push. Each
 * iteration that improves the gate is committed on its own; each iteration that does not
 * is reverted, so a long unattended run leaves a readable history rather than a pile.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ------------------------------------------------------------------- options

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const MAX_ITERATIONS = Number(flag('max', 10));
const MAX_MINUTES = Number(flag('minutes', 60));
const BRANCH = flag('branch', 'loop/bug-sweep');
const MODEL = flag('model', null);
const DRY_RUN = has('dry-run');
/** Two consecutive iterations that do not move the number means it is stuck, not slow. */
const PATIENCE = Number(flag('patience', 2));
const PERMISSION_MODE = has('yolo') ? 'bypassPermissions' : flag('permission-mode', 'acceptEdits');

const ALLOWED_TOOLS = [
  'Read', 'Edit', 'Write', 'Grep', 'Glob',
  'Bash(npm run gate)', 'Bash(npm run gate:*)', 'Bash(npm test:*)', 'Bash(npm run typecheck)',
  'Bash(node --test:*)', 'Bash(node scripts/gate.mjs:*)',
  'Bash(git diff:*)', 'Bash(git status:*)', 'Bash(git log:*)',
];

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

// --------------------------------------------------------------- preconditions

const branchNow = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branchNow === 'main' || branchNow === 'master') {
  console.error(`refusing to run on ${branchNow}. Make a branch first, or pass --branch <name>.`);
  process.exit(1);
}
if (git('status', '--porcelain') !== '') {
  console.error('refusing to run on a dirty tree — commit or stash first, so a revert cannot eat your work.');
  process.exit(1);
}
if (branchNow !== BRANCH) {
  const exists = spawnSync('git', ['rev-parse', '--verify', BRANCH], { cwd: ROOT, stdio: 'ignore' }).status === 0;
  git('checkout', ...(exists ? [BRANCH] : ['-b', BRANCH]));
  console.log(`on ${BRANCH}`);
}

// ------------------------------------------------------------------ journal

const runId = git('rev-parse', '--short', 'HEAD') + '-' + String(process.pid);
const runDir = path.join(ROOT, '.loop', runId);
mkdirSync(runDir, { recursive: true });
const journal = path.join(runDir, 'journal.md');
const iterations = path.join(runDir, 'iterations.jsonl');
writeFileSync(journal, `# loop ${runId}\n\nbranch: ${BRANCH}\nmax: ${MAX_ITERATIONS} iterations, ${MAX_MINUTES} minutes\n\n`);
const note = (text) => {
  appendFileSync(journal, `${text}\n`);
  console.log(text);
};

// --------------------------------------------------------------------- gate

function gate() {
  const result = spawnSync('node', ['scripts/gate.mjs', '--json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(result.stdout);
  } catch {
    return { ok: false, failures: [{ check: 'gate', detail: `the gate itself did not run:\n${result.stderr}` }], open: [] };
  }
}

/** Lower is better: open P0/P1 first, then total failing checks. */
const score = (g) => [g.open?.filter((o) => o.severity === 'P0' || o.severity === 'P1').length ?? 0, g.failures.length];
const better = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
const show = (s) => `${s[0]} open P0/P1, ${s[1]} failing checks`;

// ------------------------------------------------------------------- prompt

const RULES = `
Rules, in order of importance:
1. Reproduce before you repair. Write the failing test first, watch it fail, then fix it.
2. Never weaken the suite to reach green — no deleted assertions, no loosened matchers,
   no .skip, no lowered floor in scripts/gate.floors.json. The gate counts tests as well
   as failures precisely so this is visible.
3. The test title you put in docs/KNOWN_ISSUES.md under verified-by: must be the exact
   title of a test that passes. Tick the box only after it does.
4. Fix ONE ledger item per iteration. A small committed step beats a large reverted one.
5. Match the house style: node:test + node:assert/strict, colocated *.test.ts, describe
   blocks named for a behaviour, test names that are full sentences about the learner.
6. Product invariants that must survive every change: never remark on a learner's
   hesitation, never force someone to speak aloud, never invent or display a pronunciation
   score that did not come from audio, never strand a learner mid-scene.
`.trim();

function composePrompt(g, deadEnds) {
  const ledger = readFileSync(path.join(ROOT, 'docs', 'KNOWN_ISSUES.md'), 'utf8');
  const target = g.open?.find((o) => o.severity === 'P0') ?? g.open?.find((o) => o.severity === 'P1') ?? g.open?.[0];

  return [
    'You are working in the Parle repo, unattended, inside a loop that checks your work.',
    '',
    'The bar is `npm run gate`. It is currently red. Here is exactly why:',
    '',
    g.failures.map((f) => `[${f.check}] ${f.detail}`).join('\n\n'),
    '',
    target ? `Work on ledger item ${target.id} (${target.severity}): ${target.title}` : 'Work on whatever the gate is failing on.',
    '',
    'The goal file (docs/KNOWN_ISSUES.md), verbatim:',
    '',
    ledger,
    '',
    deadEnds.length ? `Attempts already made in this run that did NOT move the gate — do not repeat them:\n${deadEnds.map((d, i) => `${i + 1}. ${d}`).join('\n')}` : '',
    '',
    RULES,
    '',
    'When you are done, run `npm run gate` yourself and report the number of failing checks.',
  ].filter(Boolean).join('\n');
}

// --------------------------------------------------------------------- run

const startedAt = Date.now();
let current = gate();
note(`\n## start\n\n${show(score(current))}\n`);

if (current.ok) {
  note('gate is already green. Nothing to do.');
  process.exit(0);
}

const deadEnds = [];
let stale = 0;
let committed = 0;

for (let i = 1; i <= MAX_ITERATIONS; i++) {
  const minutes = (Date.now() - startedAt) / 60000;
  if (minutes > MAX_MINUTES) {
    note(`\nstopping: ${MAX_MINUTES} minute budget spent.`);
    break;
  }
  if (stale >= PATIENCE) {
    note(`\nstopping: ${PATIENCE} iterations in a row moved nothing. This one needs a human.`);
    break;
  }

  const before = score(current);
  const prompt = composePrompt(current, deadEnds);
  note(`\n## iteration ${i}\n\nbefore: ${show(before)}`);

  if (DRY_RUN) {
    writeFileSync(path.join(runDir, `prompt-${i}.md`), prompt);
    note(`dry run — prompt written to .loop/${runId}/prompt-${i}.md`);
    break;
  }

  const claudeArgs = ['-p', prompt, '--permission-mode', PERMISSION_MODE];
  if (PERMISSION_MODE !== 'bypassPermissions') claudeArgs.push('--allowedTools', ALLOWED_TOOLS.join(','));
  if (MODEL) claudeArgs.push('--model', MODEL);
  const run = spawnSync('claude', claudeArgs, { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.error) {
    note(`could not run the claude CLI: ${run.error.message}`);
    break;
  }

  const after = gate();
  const now = score(after);
  const improved = better(now, before);

  appendFileSync(iterations, `${JSON.stringify({ iteration: i, before, after: now, improved, at: new Date().toISOString() })}\n`);

  if (improved) {
    const changed = git('status', '--porcelain');
    if (changed === '') {
      note(`after: ${show(now)} — better, but nothing changed on disk. Not committing.`);
    } else {
      execFileSync('git', ['add', '-A'], { cwd: ROOT });
      const subject = after.open?.length !== current.open?.length
        ? `loop: close ${current.open.filter((o) => !after.open.some((n) => n.id === o.id)).map((o) => o.id).join(', ') || 'an item'}`
        : `loop: iteration ${i}`;
      execFileSync('git', ['commit', '-m', `${subject}\n\n${show(before)} -> ${show(now)}`], { cwd: ROOT });
      committed++;
      note(`after: ${show(now)} — committed.`);
    }
    stale = 0;
    current = after;
  } else {
    deadEnds.push(`iteration ${i}: left the gate at ${show(now)} (from ${show(before)})`);
    execFileSync('git', ['checkout', '--', '.'], { cwd: ROOT });
    spawnSync('git', ['clean', '-fd'], { cwd: ROOT });
    stale++;
    note(`after: ${show(now)} — no better, reverted.`);
  }

  if (after.ok) {
    note('\ngate: green.');
    break;
  }
}

const final = gate();
note(`\n## end\n\n${show(score(final))} after ${committed} commit${committed === 1 ? '' : 's'}`);
note(final.ok ? 'gate: green' : 'gate: still red — see the failures above');
process.exit(final.ok ? 0 : 1);
