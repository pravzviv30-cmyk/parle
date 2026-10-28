/**
 * What conversations, practice sets and judge checks cost, read from an
 * exported plain-text log.
 *
 *   npm run eval:cost-numbers -w @luvani/brain-playground -- <service.log>
 *
 * Like betaNumbers.ts, this script never calls a model, never calls Jev and
 * never touches the network. It reads one local file and does sums.
 *
 * ## What it reads
 *
 * One log line per text line, optionally behind a platform prefix (a timestamp,
 * a level) before the JSON or before `[luvani:`. Only these lines count:
 *
 *   {"event":"session_cost",...}     tutor-agent convo.ts formatSessionCost
 *   [luvani:cost] session=... ...     tutor-agent ttsCache.ts formatCostLine
 *   {"event":"practice_job",...}     token-server practiceWorker.ts
 *   {"event":"practice_usage",...}   token-server practiceWorker.ts
 *   {"event":"drill_validation",...} tutor-agent convo.ts formatDrillValidation
 *   [luvani:judge] answered by ... $X and [luvani:judge] memo hit ...
 *
 * Everything else is skipped and counted as skipped.
 *
 * ## The refusal
 *
 * A recognised JSON line (or `[luvani:cost]` line) carrying a field outside its
 * known shape, or a field of the wrong type, refuses the WHOLE file and nothing
 * is computed. The message names the field and the line number, never the
 * value. Voice is reported in units only (characters, seconds), never dollars.
 *
 * Exit codes: 0 ran, 1 the file was refused or unreadable, 2 BLOCKED (nothing recognised).
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { percentile } from './betaNumbers.ts';

type Kind = 'num' | 'num?' | 'bool' | 'hex8?' | 'result' | 'failure?' | 'path';
const ACTIVITIES = ['frame', 'turn', 'extract', 'curate', 'drills', 'can-do-evidence', 'correction-reason'] as const;
const SHAPES: Record<string, Record<string, Kind>> = {
  session_cost: { session: 'hex8?', usd: 'num', priceExact: 'bool', calls: 'num', abandoned: 'num', failed: 'num' },
  practice_job: { result: 'result', proposed: 'num?', accepted: 'num?', failure: 'failure?', generationMs: 'num?', sinceSessionEndMs: 'num?', usdEstimate: 'num?' },
  practice_usage: { inputTokens: 'num', outputTokens: 'num', cacheReadTokens: 'num', cacheWriteTokens: 'num', usdEstimate: 'num', priceExact: 'bool' },
  drill_validation: { path: 'path', proposed: 'num', accepted: 'num' },
};
const ACTIVITY_SHAPE: Record<string, Kind> = { calls: 'num', abandoned: 'num', failed: 'num', usd: 'num' };
const COST_KEYS = new Set(['session', 'ttsCharsBilled', 'ttsCharsCached', 'ttsCharsReplayed', 'ttsCharsBilledConversation', 'ttsSpeed', 'sttSec']);
const FAILURES = new Set(['no-valid', 'parse', 'refusal', 'unsafe-source', 'stopped', 'other']);

function fits(kind: Kind, value: unknown): boolean {
  const num = typeof value === 'number' && Number.isFinite(value);
  switch (kind) {
    case 'num': return num;
    case 'num?': return value === null || num;
    case 'bool': return typeof value === 'boolean';
    case 'hex8?': return value === null || (typeof value === 'string' && /^[0-9a-f]{8}$/.test(value));
    case 'result': return value === 'complete' || value === 'retry' || value === 'superseded';
    case 'failure?': return value === null || (typeof value === 'string' && FAILURES.has(value));
    case 'path': return value === 'live' || value === 'worker';
  }
}

export interface CostLog {
  sessions: { session: string | null; usd: number; activities: Record<string, number> }[];
  voice: Map<string, { ttsCharsBilled: number | null; sttSec: number | null }>;
  jobs: { result: string; proposed: number | null; accepted: number | null; failure: string | null; generationMs: number | null; sinceSessionEndMs: number | null; usdEstimate: number | null }[];
  practiceUsageUsd: number[];
  live: { proposed: number; accepted: number }[];
  judgeUsd: number[];
  memoHits: number;
  skipped: number;
}

export type Parsed = { ok: true; log: CostLog } | { ok: false; message: string };

export function parseCostLog(text: string): Parsed {
  const log: CostLog = { sessions: [], voice: new Map(), jobs: [], practiceUsageUsd: [], live: [], judgeUsd: [], memoHits: 0, skipped: 0 };
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    const where = `line ${i + 1}`;
    if (line.trim() === '') continue;
    const jsonAt = line.search(/\{\s*"event"\s*:/);
    if (jsonAt >= 0) {
      let value: unknown;
      try { value = JSON.parse(line.slice(jsonAt)); } catch { log.skipped++; continue; }
      const row = value as Record<string, unknown>;
      const event = typeof row?.event === 'string' ? row.event : '';
      const shape = SHAPES[event];
      if (!shape) { log.skipped++; continue; }
      for (const [key, field] of Object.entries(row)) {
        if (key === 'event') continue;
        if (event === 'session_cost' && key === 'activities') {
          if (typeof field !== 'object' || field === null || Array.isArray(field)) return { ok: false, message: `refused: ${where} session_cost field "activities" has the wrong type` };
          for (const [name, act] of Object.entries(field)) {
            if (!(ACTIVITIES as readonly string[]).includes(name)) return { ok: false, message: `refused: ${where} session_cost has an unknown activity key` };
            if (typeof act !== 'object' || act === null) return { ok: false, message: `refused: ${where} session_cost activity "${name}" has the wrong type` };
            for (const [k, v] of Object.entries(act)) {
              const kind = ACTIVITY_SHAPE[k];
              if (!kind) return { ok: false, message: `refused: ${where} session_cost activity "${name}" has an unknown field "${safeName(k)}"` };
              if (!fits(kind, v)) return { ok: false, message: `refused: ${where} session_cost field "activities.${name}.${k}" has the wrong type` };
            }
          }
          continue;
        }
        const kind = shape[key];
        if (!kind) return { ok: false, message: `refused: ${where} ${event} has an unknown field "${safeName(key)}"` };
        if (!fits(kind, field)) return { ok: false, message: `refused: ${where} ${event} field "${key}" has the wrong type` };
      }
      if (event === 'session_cost') {
        if (typeof row.usd !== 'number') return { ok: false, message: `refused: ${where} session_cost is missing "usd"` };
        const acts: Record<string, number> = {};
        for (const [name, act] of Object.entries((row.activities ?? {}) as Record<string, { usd?: number }>)) if (typeof act.usd === 'number') acts[name] = act.usd;
        log.sessions.push({ session: (row.session as string | null) ?? null, usd: row.usd, activities: acts });
      } else if (event === 'practice_job') {
        if (!fits('result', row.result)) return { ok: false, message: `refused: ${where} practice_job is missing "result"` };
        const n = (k: string) => (typeof row[k] === 'number' ? (row[k] as number) : null);
        log.jobs.push({ result: row.result as string, proposed: n('proposed'), accepted: n('accepted'), failure: (row.failure as string | null) ?? null,
          generationMs: n('generationMs'), sinceSessionEndMs: n('sinceSessionEndMs'), usdEstimate: n('usdEstimate') });
      } else if (event === 'practice_usage') {
        if (typeof row.usdEstimate === 'number') log.practiceUsageUsd.push(row.usdEstimate);
      } else if (event === 'drill_validation') {
        if (row.path === 'live' && typeof row.proposed === 'number' && typeof row.accepted === 'number') log.live.push({ proposed: row.proposed, accepted: row.accepted });
      }
      continue;
    }
    const costAt = line.indexOf('[luvani:cost]');
    if (costAt >= 0) {
      const fields: Record<string, string> = {};
      for (const token of line.slice(costAt + '[luvani:cost]'.length).trim().split(/\s+/).filter(Boolean)) {
        const eq = token.indexOf('=');
        const key = eq > 0 ? token.slice(0, eq) : token;
        if (!COST_KEYS.has(key)) return { ok: false, message: `refused: ${where} [luvani:cost] has an unknown field "${safeName(key)}"` };
        const value = token.slice(eq + 1);
        if (key === 'session' ? !/^[0-9a-f]{8}$/.test(value) : !/^\d+(\.\d+)?$/.test(value)) return { ok: false, message: `refused: ${where} [luvani:cost] field "${key}" has the wrong type` };
        fields[key] = value;
      }
      if (fields.session === undefined) { log.skipped++; continue; }
      log.voice.set(fields.session, {
        ttsCharsBilled: fields.ttsCharsBilled === undefined ? null : Number(fields.ttsCharsBilled),
        sttSec: fields.sttSec === undefined ? null : Number(fields.sttSec),
      });
      continue;
    }
    const judgeAt = line.indexOf('[luvani:judge] ');
    if (judgeAt >= 0) {
      const rest = line.slice(judgeAt + '[luvani:judge] '.length);
      if (rest.startsWith('memo hit')) { log.memoHits++; continue; }
      const price = rest.startsWith('answered by ') ? rest.match(/\$(\d+(?:\.\d+)?)(?: \(estimated\))?\s*$/) : null;
      if (price) { log.judgeUsd.push(Number(price[1])); continue; }
    }
    log.skipped++;
  }
  return { ok: true, log };
}

/** A field name is printed only when it looks like an identifier; otherwise it might be content. */
function safeName(key: string): string {
  return /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(key) ? key : '(unprintable)';
}

const NOT = 'not measured';
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]) => (xs.length === 0 ? null : sum(xs) / xs.length);
const usd = (x: number | null) => (x === null ? NOT : `$${x.toFixed(6)}`);
const ms = (x: number | null) => (x === null ? NOT : `${Math.round(x)}ms`);
const num = (x: number | null, digits = 1) => (x === null ? NOT : x.toFixed(digits));
const pct = (x: number | null) => (x === null ? NOT : `${(x * 100).toFixed(1)}%`);
const rate = (num: number, den: number) => (den === 0 ? null : num / den);

export function costReportLines(log: CostLog): string[] {
  const out: string[] = [];
  const convo = log.sessions.map((s) => s.usd);
  out.push(`conversations counted: ${log.sessions.length}`);
  out.push(`brain cost per conversation: p50 ${usd(percentile(convo, 0.5))}, p95 ${usd(percentile(convo, 0.95))}, mean ${usd(mean(convo))}`);
  for (const activity of ACTIVITIES) {
    const values = log.sessions.map((s) => s.activities[activity]).filter((v): v is number => v !== undefined);
    if (values.length > 0) out.push(`  ${activity}: mean ${usd(mean(values))} over ${values.length} conversations`);
  }
  if (log.sessions.length > 0 && log.sessions.every((s) => Object.keys(s.activities).length === 0)) out.push('  per activity: not measured');

  const joined = log.sessions.map((s) => (s.session === null ? undefined : log.voice.get(s.session))).filter((v) => v !== undefined);
  const tts = joined.map((v) => v.ttsCharsBilled).filter((v): v is number => v !== null);
  const stt = joined.map((v) => v.sttSec).filter((v): v is number => v !== null);
  out.push(`voice units per conversation (joined ${joined.length} of ${log.sessions.length}): ttsCharsBilled mean ${num(mean(tts))}, sttSec mean ${num(mean(stt))} (no voice dollars)`);

  const complete = log.jobs.filter((j) => j.result === 'complete');
  const setUsd = complete.map((j) => j.usdEstimate).filter((v): v is number => v !== null);
  out.push(`cost per practice set (${setUsd.length} completed with a price): p50 ${usd(percentile(setUsd, 0.5))}, p95 ${usd(percentile(setUsd, 0.95))}`);
  const ready = complete.map((j) => j.sinceSessionEndMs).filter((v): v is number => v !== null);
  const gen = log.jobs.map((j) => j.generationMs).filter((v): v is number => v !== null);
  out.push(`practice ready after session end (estimate): p50 ${ms(percentile(ready, 0.5))}, p95 ${ms(percentile(ready, 0.95))}`);
  out.push(`practice generation: p50 ${ms(percentile(gen, 0.5))}, p95 ${ms(percentile(gen, 0.95))}`);
  out.push(`practice usage lines: ${log.practiceUsageUsd.length}, total ${log.practiceUsageUsd.length === 0 ? NOT : usd(sum(log.practiceUsageUsd))}`);

  const liveP = sum(log.live.map((l) => l.proposed));
  const liveA = sum(log.live.map((l) => l.accepted));
  const worker = log.jobs.filter((j) => j.proposed !== null && j.accepted !== null);
  const workP = sum(worker.map((j) => j.proposed as number));
  const workA = sum(worker.map((j) => j.accepted as number));
  out.push(`validation rejection rate: live ${pct(liveP === 0 ? null : 1 - liveA / liveP)} (${liveA} of ${liveP} kept), worker ${pct(workP === 0 ? null : 1 - workA / workP)} (${workA} of ${workP} kept)`);

  const count = (r: string) => log.jobs.filter((j) => j.result === r).length;
  out.push(`practice jobs: ${log.jobs.length} (complete ${count('complete')}, retry ${count('retry')}, superseded ${count('superseded')}); retry rate ${pct(rate(count('retry'), log.jobs.length))}`);
  const reasons = new Map<string, number>();
  for (const j of log.jobs) if (j.failure !== null) reasons.set(j.failure, (reasons.get(j.failure) ?? 0) + 1);
  out.push(`practice failure rate ${pct(rate([...reasons.values()].reduce((a, b) => a + b, 0), log.jobs.length))}; reasons: ${reasons.size === 0 ? 'none recorded' : [...reasons].map(([k, v]) => `${k} ${v}`).join(', ')}`);

  out.push(`judge checks answered: ${log.judgeUsd.length}, cost per check ${usd(mean(log.judgeUsd))}; memo hits ${log.memoHits}, hit rate ${pct(rate(log.memoHits, log.memoHits + log.judgeUsd.length))}`);
  out.push(`lines skipped: ${log.skipped}`);
  return out;
}

export function runCostNumbers(options: { args: readonly string[]; log: (line: string) => void }): number {
  const { args, log } = options;
  const file = args.find((arg) => !arg.startsWith('--'));
  if (file === undefined) {
    log('Pass the exported log: npm run eval:cost-numbers -w @luvani/brain-playground -- <service.log>');
    return 1;
  }
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    log(`could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const parsed = parseCostLog(text);
  if (!parsed.ok) {
    log(`${file} ${parsed.message}`);
    return 1;
  }
  const l = parsed.log;
  if (l.sessions.length + l.voice.size + l.jobs.length + l.practiceUsageUsd.length + l.live.length + l.judgeUsd.length + l.memoHits === 0) {
    log(`BLOCKED: ${file} holds no cost lines (${l.skipped} skipped).`);
    return 2;
  }
  for (const line of costReportLines(l)) log(line);
  return 0;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = runCostNumbers({ args: process.argv.slice(2), log: (line) => console.log(line) });
}
