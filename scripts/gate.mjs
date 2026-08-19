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
 *   4. the goal: docs/KNOWN_ISSUES.md has no open P0/P1, and every ticked box names a
 *      test that actually ran and actually passed
 *
 * Check 4 is the one that matters. Without it the loop can declare victory by editing a
 * checkbox; with it, the only way to tick a box is to make a named test pass.
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

const typecheck = run('npm', ['run', 'typecheck']);
if (typecheck.code !== 0) {
  const errors = typecheck.out
    .split('\n')
    .filter((l) => /error TS\d+/.test(l))
    .slice(0, 20);
  fail('typecheck', errors.length ? errors.join('\n') : typecheck.out.slice(-2000));
}

// -------------------------------------------------------------------- 2. tests

const floors = JSON.parse(readFileSync(FLOORS_PATH, 'utf8'));
/** Every test title that ran and passed, across every workspace. */
const passed = new Set();
/** @type {Record<string, {tests: number, pass: number, fail: number}>} */
const counts = {};

for (const pkg of Object.keys(floors)) {
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

// --------------------------------------------------------------------- 4. goal

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
    if (entry.severity === 'P0' || entry.severity === 'P1') {
      fail('goal', `${entry.id} (${entry.severity}) is still open: ${entry.title}`);
    }
    continue;
  }
  // Ticked. Every test it names must have actually run and actually passed.
  for (const title of entry.verifiedBy) {
    if (!passed.has(title)) {
      fail('goal', `${entry.id} is ticked but no passing test is named "${title}" — tick follows the test, not the other way round`);
    }
  }
}

// -------------------------------------------------------------------- report

const ok = failures.length === 0;

if (bless) {
  if (!ok) {
    console.error('refusing to bless floors while the gate is red');
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
  console.log(`  total: ${total} tests`);
  if (ok) {
    console.log('\ngate: green');
  } else {
    console.log(`\ngate: ${failures.length} failing check${failures.length === 1 ? '' : 's'}\n`);
    for (const f of failures) console.log(`  [${f.check}] ${f.detail}\n`);
  }
}

process.exit(ok ? 0 : 1);
