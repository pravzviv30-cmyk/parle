/**
 * The beta's session numbers, read from a file the founder exported.
 *
 *   npm run eval:beta-numbers -w @luvani/brain-playground -- <events.json>
 *
 * The file is a JSON array of rows, or `{ "rows": [...] }`, one row per
 * `live_session_finished` event. This script never calls a model, never calls
 * Jev and never touches the network. It reads one local file and does sums.
 *
 * ## What a row may hold
 *
 * Exactly the properties the app sends, quoted from
 * apps/mobile/src/analytics/sessionFinished.ts (`sessionFinishedEvent`):
 *
 *   properties: {
 *     kind: session.kind,                 // 'lesson' | 'convo'
 *     voice: session.voice,               // boolean
 *     turns: count(session.turns, 1_000),
 *     rescues: count(session.rescues, 1_000),
 *     unassistedPct: count(session.unassistedRate * 100, 100),
 *     replyLatencyMs: latency === null || ... ? null : Math.round(latency),
 *   }
 *
 * and `FinishedSession.replyLatencyMs` is "Median phone-measured reply wait, or
 * null when nothing was measured". So each row's latency is already a session
 * median, and the p50 and p95 here are over sessions, not over turns.
 *
 * A row may be those six fields flat, or `{ "properties": { ...those six } }`,
 * which is how an event export wraps them. Nothing else at the top level is
 * accepted: no `event`, `timestamp`, `distinct_id`, `user_id` or `uuid`. An
 * export that carries an identifier is refused rather than quietly stripped, so
 * the founder learns the export was wider than it needed to be.
 *
 * ## The refusal
 *
 * This protects against someone exporting content. If ANY row carries a field
 * outside the six (a `transcript`, a `text`, an email), the WHOLE file is
 * refused with the field named, and nothing is computed. The same goes for a
 * field of the wrong type. The message names the field and the row, never the
 * value, so a refused value is not echoed into a terminal or a log.
 *
 * Exit codes: 0 ran, 1 the file was refused or unreadable, 2 BLOCKED (no rows).
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export const BETA_FIELDS = ['kind', 'voice', 'turns', 'rescues', 'unassistedPct', 'replyLatencyMs'] as const;
export type BetaField = (typeof BETA_FIELDS)[number];

export interface BetaRow {
  kind: 'lesson' | 'convo';
  voice: boolean;
  turns: number;
  rescues: number;
  unassistedPct: number;
  replyLatencyMs: number | null;
}

export type ParsedRows = { ok: true; rows: BetaRow[] } | { ok: false; message: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Validate every row. Any surprise refuses the whole file. */
export function parseBetaRows(json: unknown): ParsedRows {
  const list = Array.isArray(json) ? json : isObject(json) && Array.isArray(json.rows) ? json.rows : null;
  if (list === null) return { ok: false, message: 'refused: the file must be a JSON array of rows, or { "rows": [...] }.' };
  if (isObject(json) && !Array.isArray(json)) {
    const extra = Object.keys(json).filter((key) => key !== 'rows');
    if (extra.length > 0) return { ok: false, message: `refused: the file has a top-level field "${extra[0]}". Only "rows" is read.` };
  }

  const rows: BetaRow[] = [];
  for (const [index, entry] of list.entries()) {
    const where = `row ${index + 1}`;
    if (!isObject(entry)) return { ok: false, message: `refused: ${where} is not an object.` };
    let fields: Record<string, unknown> = entry;
    if ('properties' in entry) {
      const wrapper = Object.keys(entry).filter((key) => key !== 'properties');
      if (wrapper.length > 0) {
        return { ok: false, message: `refused: ${where} has a field "${wrapper[0]}" outside properties. Export only the properties of live_session_finished.` };
      }
      if (!isObject(entry.properties)) return { ok: false, message: `refused: ${where} has properties that are not an object.` };
      fields = entry.properties;
    }
    for (const key of Object.keys(fields)) {
      if (!(BETA_FIELDS as readonly string[]).includes(key)) {
        return { ok: false, message: `refused: ${where} has a field "${key}", which is not one of ${BETA_FIELDS.join(', ')}. Nothing was read. Export only those fields.` };
      }
    }
    for (const key of BETA_FIELDS) {
      if (!(key in fields)) return { ok: false, message: `refused: ${where} is missing "${key}".` };
    }
    const { kind, voice, turns, rescues, unassistedPct, replyLatencyMs } = fields;
    if (kind !== 'lesson' && kind !== 'convo') return { ok: false, message: `refused: ${where} field "kind" must be lesson or convo.` };
    if (typeof voice !== 'boolean') return { ok: false, message: `refused: ${where} field "voice" must be true or false.` };
    if (!isCount(turns)) return { ok: false, message: `refused: ${where} field "turns" must be a number of 0 or more.` };
    if (!isCount(rescues)) return { ok: false, message: `refused: ${where} field "rescues" must be a number of 0 or more.` };
    if (!isCount(unassistedPct) || unassistedPct > 100) {
      return { ok: false, message: `refused: ${where} field "unassistedPct" must be a number from 0 to 100.` };
    }
    if (replyLatencyMs !== null && !isCount(replyLatencyMs)) {
      return { ok: false, message: `refused: ${where} field "replyLatencyMs" must be a number of 0 or more, or null.` };
    }
    rows.push({ kind, voice, turns, rescues, unassistedPct, replyLatencyMs });
  }
  return { ok: true, rows };
}

export interface BetaGroup {
  label: string;
  sessions: number;
  totalTurns: number;
  totalRescues: number;
  /** Null when there are no turns to divide by. */
  rescuesPerTurn: number | null;
  meanUnassistedPct: number | null;
  medianUnassistedPct: number | null;
  /** Over non-null values only. */
  latencyCount: number;
  latencyP50: number | null;
  latencyP95: number | null;
  nullLatencySessions: number;
}

/** The middle value, or the mean of the two middle values for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Nearest rank, as replyWaitSummary does. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] as number;
}

export function summariseGroup(label: string, rows: readonly BetaRow[]): BetaGroup {
  const totalTurns = rows.reduce((n, r) => n + r.turns, 0);
  const totalRescues = rows.reduce((n, r) => n + r.rescues, 0);
  const unassisted = rows.map((r) => r.unassistedPct);
  const latencies = rows.map((r) => r.replyLatencyMs).filter((ms): ms is number => ms !== null);
  return {
    label,
    sessions: rows.length,
    totalTurns,
    totalRescues,
    rescuesPerTurn: totalTurns === 0 ? null : totalRescues / totalTurns,
    meanUnassistedPct: unassisted.length === 0 ? null : unassisted.reduce((a, b) => a + b, 0) / unassisted.length,
    medianUnassistedPct: median(unassisted),
    latencyCount: latencies.length,
    latencyP50: percentile(latencies, 0.5),
    latencyP95: percentile(latencies, 0.95),
    nullLatencySessions: rows.length - latencies.length,
  };
}

export function summariseBeta(rows: readonly BetaRow[]): BetaGroup[] {
  return [
    summariseGroup('all sessions', rows),
    summariseGroup('lesson', rows.filter((r) => r.kind === 'lesson')),
    summariseGroup('convo', rows.filter((r) => r.kind === 'convo')),
  ];
}

const num = (n: number | null, digits = 1): string => (n === null ? 'n/a' : n.toFixed(digits));

export function betaReportLines(groups: readonly BetaGroup[]): string[] {
  const lines: string[] = [];
  for (const g of groups) {
    lines.push('', `${g.label}: ${g.sessions} sessions`);
    if (g.sessions === 0) continue;
    lines.push(
      `  turns: ${g.totalTurns} in total, ${g.totalRescues} rescues, ${num(g.rescuesPerTurn, 3)} rescues per turn`,
      `  unassisted: mean ${num(g.meanUnassistedPct)}%, median ${num(g.medianUnassistedPct)}%`,
      g.latencyCount === 0
        ? '  reply latency: no session measured one'
        : `  reply latency over ${g.latencyCount} sessions (each a session median): p50 ${g.latencyP50}ms, p95 ${g.latencyP95}ms`,
      `  sessions with no latency measured: ${g.nullLatencySessions}`,
    );
  }
  return lines;
}

/** 0 ran, 1 refused or unreadable, 2 BLOCKED. */
export function runBetaNumbers(options: { args: readonly string[]; log: (line: string) => void }): number {
  const { args, log } = options;
  const file = args.find((arg) => !arg.startsWith('--'));
  if (file === undefined) {
    log('Pass the exported file: npm run eval:beta-numbers -w @luvani/brain-playground -- <events.json>');
    return 1;
  }
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    log(`could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (text.trim() === '') {
    log(`BLOCKED: ${file} is empty, so there are no sessions to count.`);
    return 2;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // The parser's own message can quote the start of the file. Say nothing of it.
    log(`refused ${file}: it is not valid JSON.`);
    return 1;
  }
  const parsed = parseBetaRows(json);
  if (!parsed.ok) {
    log(`${file} ${parsed.message}`);
    return 1;
  }
  if (parsed.rows.length === 0) {
    log(`BLOCKED: ${file} holds no rows, so there are no sessions to count.`);
    return 2;
  }
  log(`beta numbers over ${parsed.rows.length} live_session_finished events`);
  for (const line of betaReportLines(summariseBeta(parsed.rows))) log(line);
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = runBetaNumbers({ args: process.argv.slice(2), log: (line) => console.log(line) });
}
