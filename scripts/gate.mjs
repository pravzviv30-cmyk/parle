#!/usr/bin/env node
/**
 * The bar.
 *
 * A loop that grades its own homework needs a grader it cannot argue with. This is it:
 * every check either passes or fails on a number, a file, or a test title — never on a
 * judgement. `npm run loop` reads the failures out of `--json` and re-prompts itself
 * until this exits 0.
 *
 * Checks, in order:
 *   1. typecheck across every workspace
 *   2. tests: zero failures, and no workspace below its recorded floor
 *   3. hygiene: nothing focused with .only, nothing newly skipped
 *   4. agents: the model pins the loops depend on are still in place
 *   5. the goal: docs/KNOWN_ISSUES.md has no open P0/P1, and every ticked box names a
 *      test that actually ran and actually passed
 *
 * Check 5 is the one that matters. Without it the loop can declare victory by editing a
 * checkbox; with it, the only way to tick a box is to make a named test pass.
 *
 * `--fast` answers a different question: **is this commit malformed?** It runs only the
 * checks that read files rather than running them, so `.githooks/pre-commit` can be
 * instant. Two things it deliberately does not check:
 *
 *   - an open P0 or P1, because /forge files its ledger entries *before* the work. A red
 *     ledger is the expected state mid-build, and a hook that refused it would make the
 *     whole forge workflow uncommittable.
 *   - whether a ticked box names a passing test, because no test ran to name.
 *
 * Both are the full gate's job, at push time. Fast mode is a smoke alarm, not the bar.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOORS_PATH = path.join(ROOT, 'scripts', 'gate.floors.json');
const LEDGER_PATH = path.join(ROOT, 'docs', 'KNOWN_ISSUES.md');

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const bless = args.includes('--bless');
// Skips the two checks that run code rather than reading it. See the header.
const fast = args.includes('--fast');

/** @type {{check: string, detail: string}[]} */
const failures = [];
const fail = (check, detail) => failures.push({ check, detail });

function run(command, commandArgs) {
  try {
    const stdout = execFileSync(command, commandArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, out: stdout };
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    return { code: typeof err.status === 'number' ? err.status : 1, out };
  }
}

// ---------------------------------------------------------------- 1. typecheck

if (!fast) {
  const typecheck = run('npm', ['run', 'typecheck']);
  if (typecheck.code !== 0) {
    const errors = typecheck.out
      .split('\n')
      .filter((l) => /error TS\d+/.test(l))
      .slice(0, 20);
    fail('typecheck', errors.length ? errors.join('\n') : typecheck.out.slice(-2000));
  }
}

// -------------------------------------------------------------------- 2. tests

const floors = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'));
/** Every test title that ran and passed, across every workspace. */
const passed = new Set();
/** @type {Record<string, {tests: number, pass: number, fail: number}>} */
const counts = {};

for (const pkg of fast ? [] : Object.keys(floors)) {
  const result = run('npm', ['test', `--workspace=${pkg}`]);
  const num = (label) => {
    const m = result.out.match(new RegExp(`^ℹ ${label} (\\d+)$`, 'm'));
    return m ? Number(m[1]) : null;
  };
  const tests = num('tests');
  const pass = num('pass');
  const failed = num('fail');

  if (tests === null || failed === null) {
    fail('tests', `${pkg}: could not read a test summary — the suite did not finish.\n${result.out.slice(-2000)}`);
    continue;
  }
  counts[pkg] = { tests, pass: pass ?? 0, fail: failed };

  if (failed > 0) {
    const names = result.out
      .split('\n')
      .filter((l) => l.trim().startsWith('✖ '))
      .slice(0, 15)
      .map((l) => l.trim());
    fail('tests', `${pkg}: ${failed} failing\n${names.join('\n')}`);
  }
  // A suite that never loads takes its whole file with it and still exits 0. The count
  // floor is the only thing that notices — see CLAUDE.md on worktrees.
  if (tests < floors[pkg]) {
    fail('tests', `${pkg}: ${tests} tests ran, floor is ${floors[pkg]}. A suite is missing, not merely failing.`);
  }

  for (const line of result.out.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('✔ ')) continue;
    passed.add(t.slice(2).replace(/\s*\([\d.]+m?s\)\s*$/, '').trim());
  }
}

// ------------------------------------------------------------------ 3. hygiene

function testFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'graphify-out' || entry === '.loop') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

for (const file of testFiles(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (/\b(test|describe|it)\.only\s*\(/.test(source)) {
    fail('hygiene', `${rel}: a focused .only() hides every other test in the file`);
  }
  if (/\b(test|describe|it)\.skip\s*\(/.test(source)) {
    fail('hygiene', `${rel}: a skipped test is a test that is not defending anything`);
  }
}

// ------------------------------------------------------------------- 4. agents

// Which model runs which agent is the whole design of /forge and /bug-sweep, and it lives
// entirely in one line of frontmatter. That line fails quietly: delete `model: fable` and
// the agent inherits the session model, the thinking silently moves, and every run still
// looks exactly the same from the outside. Nothing else in this repo would ever notice.

/**
 * Agent name -> the model it must stay pinned to. Fable thinks, Opus builds.
 *
 * The four loop roles came first. The subsystem and product specialists below own a
 * territory the way a senior lead owns a subsystem, and /forge routes a contract to
 * whichever one owns the files or decision it touches. Fable is reserved for agents whose
 * whole output is a judgement or map rather than code.
 */
const AGENT_MODELS = {
  // the loop
  'design-architect': 'fable',
  'work-judge': 'fable',
  'bug-hunter': 'opus',
  'fix-verifier': 'opus',
  // the team, builders
  'frontend-engineer': 'opus',
  'backend-engineer': 'opus',
  'data-engineer': 'opus',
  'auth-engineer': 'opus',
  'api-engineer': 'opus',
  'revenue-engineer': 'opus',
  'performance-engineer': 'opus',
  'security-engineer': 'opus',
  'product-orchestrator': 'opus',
  'data-sync-engineer': 'opus',
  'voice-platform-engineer': 'opus',
  'tutor-behaviour-engineer': 'opus',
  'learning-science-engineer': 'opus',
  'onboarding-ux-engineer': 'opus',
  'practice-ux-engineer': 'opus',
  'progress-retention-engineer': 'opus',
  'design-system-engineer': 'opus',
  'privacy-safety-engineer': 'opus',
  'observability-engineer': 'opus',
  'deploy-engineer': 'opus',
  // the team, read-only
  'release-engineer': 'opus',
  'scaling-engineer': 'fable',
  'repository-archaeologist': 'fable',
  'social-systems-engineer': 'fable',
  'qa-release-engineer': 'opus',
};

const readOrNull = (file) => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

/** The frontmatter block only. A `model:` line in the prose body is not a pin. */
function frontmatter(source) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return block ? block[1] : null;
}

for (const [agent, expected] of Object.entries(AGENT_MODELS)) {
  const source = readOrNull(path.join(ROOT, '.claude', 'agents', `${agent}.md`));
  if (source === null) {
    fail('agents', `.claude/agents/${agent}.md is missing — ${agent} cannot be dispatched`);
    continue;
  }
  const head = frontmatter(source);
  if (head === null) {
    fail('agents', `${agent}: no frontmatter block, so nothing about it is configured`);
    continue;
  }
  const pinned = head.match(/^model:\s*(\S+)\s*$/m);
  if (!pinned) {
    fail('agents', `${agent}: no model pin — it would silently inherit the session model`);
  } else if (pinned[1] !== expected) {
    fail('agents', `${agent}: pinned to ${pinned[1]}, expected ${expected}`);
  }
}

// A pin only defends an agent the map knows about. Without this, adding a new agent and
// forgetting to list it above produces exactly the silence this check exists to prevent:
// the file is there, it dispatches, and it runs on whatever model the session happened to
// be using. So the directory is the source of truth for *which* agents must be pinned, and
// the map is the source of truth for *what* they are pinned to.
let agentFiles = [];
try {
  agentFiles = readdirSync(path.join(ROOT, '.claude', 'agents'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3));
} catch {
  fail('agents', '.claude/agents/ is missing — no agent can be dispatched');
}
for (const agent of agentFiles) {
  if (!(agent in AGENT_MODELS)) {
    fail('agents', `${agent}: on disk but not pinned in gate.mjs — it would inherit the session model unnoticed`);
  }
}

for (const command of ['forge', 'bug-sweep', 'ship']) {
  if (readOrNull(path.join(ROOT, '.claude', 'commands', `${command}.md`)) === null) {
    fail('agents', `.claude/commands/${command}.md is missing — /${command} does not exist`);
  }
}

// --------------------------------------------------------------------- 5. goal

const ledger = readFileSync(LEDGER_PATH, 'utf8');
/** @type {{id: string, title: string, severity: string, done: boolean, verifiedBy: string[]}[]} */
const entries = [];
let current = null;

for (const raw of ledger.split('\n')) {
  const heading = raw.match(/^###\s+(\S+)\s+[-—]+\s+(.+)$/);
  if (heading) {
    if (current) entries.push(current);
    current = { id: heading[1], title: heading[2].trim(), severity: '', done: false, verifiedBy: [] };
    continue;
  }
  if (!current) continue;
  const severity = raw.match(/^-\s*severity:\s*(P\d)/);
  if (severity) current.severity = severity[1];
  const status = raw.match(/^-\s*status:\s*\[( |x)\]/);
  if (status) current.done = status[1] === 'x';
  const verified = raw.match(/^-\s*verified-by:\s*`(.+)`\s*$/);
  if (verified) current.verifiedBy.push(verified[1]);
}
if (current) entries.push(current);

if (entries.length === 0) fail('goal', 'docs/KNOWN_ISSUES.md has no entries — the goal file cannot be empty');

for (const entry of entries) {
  if (!/^P\d$/.test(entry.severity)) fail('goal', `${entry.id}: no severity`);
  if (entry.verifiedBy.length === 0) fail('goal', `${entry.id}: no verified-by test named`);

  if (!entry.done) {
    // Open work is the expected state while /forge builds against its own entries, so the
    // pre-commit hook must not refuse it. The full gate still does.
    if (!fast && (entry.severity === 'P0' || entry.severity === 'P1')) {
      fail('goal', `${entry.id} (${entry.severity}) is still open: ${entry.title}`);
    }
    continue;
  }
  // Ticked. Every test it names must have actually run and actually passed. In fast mode
  // nothing ran, so there is no honest way to check this — the full gate does it at push.
  if (fast) continue;
  for (const title of entry.verifiedBy) {
    if (!passed.has(title)) {
      fail('goal', `${entry.id} is ticked but no passing test is named "${title}" — tick follows the test, not the other way round`);
    }
  }
}

// -------------------------------------------------------------------- report

const ok = failures.length === 0;

if (bless && fast) {
  // Floors are raised from observed counts, and in fast mode nothing was counted.
  console.error('refusing to bless floors in --fast mode: no suite ran, so there is nothing to raise them to');
  process.exit(1);
}

if (bless) {
  // Blessing raises the floors, so it only needs the suites to be sound — an open
  // ledger item is work still to do, not a reason to leave new tests undefended.
  const blocking = failures.filter((f) => f.check !== 'goal');
  if (blocking.length > 0) {
    console.error('refusing to bless floors while typecheck, tests, hygiene or agents are red:');
    for (const f of blocking) console.error(`  [${f.check}] ${f.detail}`);
    process.exit(1);
  }
  const next = { ...floors };
  for (const [pkg, c] of Object.entries(counts)) next[pkg] = Math.max(floors[pkg] ?? 0, c.tests);
  writeFileSync(FLOORS_PATH, `${JSON.stringify(next, null, 2)}\n`);
  console.log('floors raised to', next);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify({ ok, failures, counts, open: entries.filter((e) => !e.done).map((e) => ({ id: e.id, severity: e.severity, title: e.title })) }, null, 2));
} else {
  const total = Object.values(counts).reduce((n, c) => n + c.tests, 0);
  for (const [pkg, c] of Object.entries(counts)) {
    console.log(`  ${c.fail === 0 ? '✔' : '✖'} ${pkg}: ${c.tests} tests, ${c.fail} failing (floor ${floors[pkg]})`);
  }
  if (fast) {
    console.log('  fast: hygiene, agents and the ledger only. No suite ran and no tick was verified.');
  } else {
    console.log(`  total: ${total} tests`);
  }
  if (ok) {
    console.log(fast ? '\ngate: fast checks green' : '\ngate: green');
  } else {
    console.log(`\ngate: ${failures.length} failing check${failures.length === 1 ? '' : 's'}\n`);
    for (const f of failures) console.log(`  [${f.check}] ${f.detail}\n`);
  }
}

process.exit(ok ? 0 : 1);
