/**
 * The beta numbers script reads counts and nothing else. These tests hold it to
 * the arithmetic on a small fixture, to the refusal of any extra field (the
 * guard against exporting content), and to BLOCKED on an empty file.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { betaReportLines, median, parseBetaRows, percentile, summariseBeta } from './betaNumbers.ts';

const EVAL = fileURLToPath(new URL('./betaNumbers.ts', import.meta.url));
const WORKSPACE = fileURLToPath(new URL('../..', import.meta.url));

const row = (kind: 'lesson' | 'convo', turns: number, rescues: number, unassistedPct: number, replyLatencyMs: number | null) => ({
  kind,
  voice: true,
  turns,
  rescues,
  unassistedPct,
  replyLatencyMs,
});

const FIXTURE = [
  row('convo', 10, 2, 80, 1000),
  row('convo', 20, 1, 60, 2000),
  row('convo', 5, 0, 100, null),
  row('lesson', 8, 4, 50, 3000),
  // The event-export wrapper holds the same six fields under properties.
  { properties: row('lesson', 12, 2, 70, 500) },
  row('lesson', 4, 0, 95, 1500),
];

function fixtureFile(content: unknown): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'luvani-beta-')), 'events.json');
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

function runCli(file: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, ['--experimental-strip-types', EVAL, file], {
      encoding: 'utf8',
      cwd: WORKSPACE,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? -1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

test('medians and percentiles', () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(percentile([500, 1000, 1500, 2000, 3000], 0.5), 1500);
  assert.equal(percentile([500, 1000, 1500, 2000, 3000], 0.95), 3000);
  assert.equal(percentile([], 0.5), null);
});

test('the fixture totals, medians, percentiles and split by kind', () => {
  const parsed = parseBetaRows(FIXTURE);
  assert.ok(parsed.ok);
  const [all, lesson, convo] = summariseBeta(parsed.rows);

  assert.equal(all?.sessions, 6);
  assert.equal(all?.totalTurns, 59);
  assert.equal(all?.totalRescues, 9);
  assert.ok(Math.abs((all?.rescuesPerTurn ?? 0) - 9 / 59) < 1e-9);
  assert.ok(Math.abs((all?.meanUnassistedPct ?? 0) - 455 / 6) < 1e-9);
  assert.equal(all?.medianUnassistedPct, 75);
  assert.equal(all?.latencyCount, 5);
  assert.equal(all?.latencyP50, 1500);
  assert.equal(all?.latencyP95, 3000);
  assert.equal(all?.nullLatencySessions, 1);

  assert.equal(convo?.sessions, 3);
  assert.equal(convo?.totalTurns, 35);
  assert.equal(convo?.totalRescues, 3);
  assert.equal(convo?.meanUnassistedPct, 80);
  assert.equal(convo?.medianUnassistedPct, 80);
  assert.equal(convo?.latencyCount, 2);
  assert.equal(convo?.latencyP50, 1000);
  assert.equal(convo?.latencyP95, 2000);
  assert.equal(convo?.nullLatencySessions, 1);

  assert.equal(lesson?.sessions, 3);
  assert.equal(lesson?.totalTurns, 24);
  assert.equal(lesson?.rescuesPerTurn, 0.25);
  assert.ok(Math.abs((lesson?.meanUnassistedPct ?? 0) - 215 / 3) < 1e-9);
  assert.equal(lesson?.medianUnassistedPct, 70);
  assert.equal(lesson?.latencyP50, 1500);
  assert.equal(lesson?.latencyP95, 3000);
  assert.equal(lesson?.nullLatencySessions, 0);

  const text = betaReportLines([all!, convo!, lesson!]).join('\n');
  assert.match(text, /all sessions: 6 sessions/);
  assert.match(text, /0\.153 rescues per turn/);
  assert.match(text, /p50 1500ms, p95 3000ms/);
});

test('the CLI prints the report and exits 0, also for { rows: [...] }', () => {
  for (const content of [FIXTURE, { rows: FIXTURE }]) {
    const { code, out } = runCli(fixtureFile(content));
    assert.equal(code, 0, out);
    assert.match(out, /beta numbers over 6 live_session_finished events/);
    assert.match(out, /convo: 3 sessions/);
    assert.match(out, /lesson: 3 sessions/);
  }
});

test('a row with a field outside the six refuses the whole file and names it, not its value', () => {
  const secret = 'je voudrais un cafe et mon nom est Marie';
  const dirty = [...FIXTURE, { ...row('convo', 3, 0, 100, 900), transcript: secret }];
  const parsed = parseBetaRows(dirty);
  assert.equal(parsed.ok, false);
  assert.match(parsed.ok ? '' : parsed.message, /"transcript"/);
  assert.match(parsed.ok ? '' : parsed.message, /row 7/);

  const { code, out } = runCli(fixtureFile(dirty));
  assert.equal(code, 1, out);
  assert.match(out, /transcript/);
  assert.doesNotMatch(out, /Marie/);
  assert.doesNotMatch(out, /beta numbers over/, 'nothing is computed from a refused file');
});

test('identifiers beside properties, and wrong types, are refused too', () => {
  assert.match((parseBetaRows([{ properties: row('convo', 1, 0, 100, null), distinct_id: 'u1' }]) as { message: string }).message, /"distinct_id"/);
  assert.match((parseBetaRows([{ ...row('convo', 1, 0, 100, null), email: 'a@b.c' }]) as { message: string }).message, /"email"/);
  assert.match((parseBetaRows({ rows: FIXTURE, owner: 'me' }) as { message: string }).message, /"owner"/);
  assert.match((parseBetaRows([{ ...row('convo', 1, 0, 100, null), kind: 'hello' }]) as { message: string }).message, /"kind"/);
  assert.match((parseBetaRows([{ ...row('convo', 1, 0, 100, null), unassistedPct: 140 }]) as { message: string }).message, /"unassistedPct"/);
  assert.match((parseBetaRows([{ kind: 'convo' }]) as { message: string }).message, /missing/);
});

test('an empty file or no rows is BLOCKED and exits 2', () => {
  for (const content of ['', '   \n', [], { rows: [] }]) {
    const { code, out } = runCli(fixtureFile(content));
    assert.equal(code, 2, out);
    assert.match(out, /BLOCKED/);
  }
});

test('a missing file or bad JSON exits 1 without echoing the file', () => {
  assert.equal(runCli(path.join(tmpdir(), 'luvani-does-not-exist.json')).code, 1);
  const bad = runCli(fixtureFile('{"transcript": "je suis Marie"'));
  assert.equal(bad.code, 1);
  assert.doesNotMatch(bad.out, /Marie/);
});
