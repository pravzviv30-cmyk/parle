/**
 * The session eval: did the tutor keep its own rules, turn by turn?
 *
 *   npm run eval:sessions -w @luvani/brain-playground
 *   npm run eval:sessions -w @luvani/brain-playground -- --dir <folder>
 *   npm run eval:sessions -w @luvani/brain-playground -- <record.json> ...
 *   npm run eval:sessions -w @luvani/brain-playground -- --jev
 *
 * The other evals score one call at a time. A learner meets the tutor as a
 * session: they go quiet, ask for help, try, get a recast, try again. This run
 * reads a recorded session and scores every turn against the five rules in
 * sessionChecks.ts, each cited to the doc or prompt line it comes from.
 *
 * ## The standard, and where it comes from
 *
 * Nothing new is invented here. rescue and no-read-back are docs/PEDAGOGY.md
 * and the NO-CHEATING RULE in the system prompt; gentle is the prompt's "never
 * say wrong" and "never remark on hesitation", enforced with the brain's own
 * copyViolations; level-fit is RUNG_LENGTH; safety is the tutor agent's own
 * outputGuard and safetyDecision. Reply wait is printed and never judged,
 * because no budget for it exists anywhere in the repo.
 *
 * ## Whose sessions
 *
 * Synthetic or dev only. No learner has consented to a transcript being kept,
 * so sessionRecord.ts refuses any other source, and --jev checks again before
 * anything leaves the machine. The synthetic set in sessions/synthetic is hand
 * labelled, one deliberate failure per rule at least, so a run on it exits 1
 * and lists exactly those turns. A run that agrees with every label is the
 * proof the checks measure what they claim.
 *
 * ## Jev is advisory
 *
 * --jev asks TypeSafe's Jev two typed questions per turn and prints its answer
 * beside the deterministic verdict. It never changes a verdict. Where the two
 * disagree, the turn is listed for a human to read.
 *
 * With no records this prints BLOCKED and exits 2. It never passes quietly.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { JevAsker, JevJson, JevQuestion } from '@luvani/brain/llm';

import { SESSION_CHECKS, replyWaitSummary, type CheckResult } from './sessionChecks.ts';
import { CHECK_IDS, SESSION_SOURCES, parseSessionRecord, type CheckId, type SessionRecord, type SessionTurn } from './sessionRecord.ts';

export const SYNTHETIC_DIR = fileURLToPath(new URL('./sessions/synthetic/', import.meta.url));

export interface TurnScore {
  /** `<record>#<n>`, the id every report line uses. */
  turn: string;
  results: CheckResult[];
}

export interface SessionScore {
  id: string;
  turns: TurnScore[];
}

export function scoreTurn(turn: SessionTurn): CheckResult[] {
  return CHECK_IDS.map((check) => SESSION_CHECKS[check](turn));
}

export function scoreSession(record: SessionRecord): SessionScore {
  return {
    id: record.id,
    turns: record.turns.map((turn) => ({ turn: `${record.id}#${turn.n}`, results: scoreTurn(turn) })),
  };
}

export interface CheckSummary {
  check: CheckId;
  applicable: number;
  passed: number;
  failures: { turn: string; reason: string }[];
}

export interface SessionsSummary {
  ok: boolean;
  checks: CheckSummary[];
}

export function summariseSessions(results: readonly SessionScore[]): SessionsSummary {
  const checks = CHECK_IDS.map((check): CheckSummary => {
    const summary: CheckSummary = { check, applicable: 0, passed: 0, failures: [] };
    for (const session of results) {
      for (const turn of session.turns) {
        const result = turn.results.find((r) => r.check === check);
        if (result === undefined || result.verdict === 'n/a') continue;
        summary.applicable += 1;
        if (result.verdict === 'pass') summary.passed += 1;
        else summary.failures.push({ turn: turn.turn, reason: result.reason ?? '' });
      }
    }
    return summary;
  });
  return { ok: checks.every((c) => c.failures.length === 0), checks };
}

/** Where a hand label and the verdict differ. Empty for a record with no labels. */
export function labelMismatches(record: SessionRecord): string[] {
  const out: string[] = [];
  for (const turn of record.turns) {
    const results = scoreTurn(turn);
    for (const result of results) {
      const label = turn.expect?.[result.check];
      const verdict = result.verdict;
      if (turn.expect === undefined) continue;
      if ((label ?? 'n/a') !== verdict) out.push(`${record.id}#${turn.n} ${result.check}: labelled ${label ?? 'n/a'}, scored ${verdict}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Jev, advisory only
// ---------------------------------------------------------------------------

export const GIVE_AWAY_QUESTION: JevQuestion = {
  type: 'noul',
  instructions: {
    question: "Does the tutor's line give away the learner's answer on the card before they try?",
    note: '`card_french` is what the learner is meant to work out. `tutor` is everything the tutor said this turn.',
  },
  criteria: {
    true: 'The tutor says the French on the card, or enough of it that the learner only has to repeat it.',
    false: 'The tutor leaves the answer for the learner to find.',
  },
};

/** Lowest first. The scolding half is the first two. */
export const WARMTH_LEVELS = ['scolding', 'cool', 'kind', 'warm'] as const;

export const WARMTH_QUESTION: JevQuestion = {
  type: 'score',
  instructions: 'How does the tutor sound to a beginner who is trying to speak French in `tutor`?',
  criteria: [...WARMTH_LEVELS],
};

export interface JevNote {
  turn: string;
  giveAway: number | null;
  warmth: string | null;
  disagreements: string[];
}

/**
 * Ask Jev about one turn and compare with the verdicts. Never edits `results`.
 * Returns null when no question applies.
 */
/** Below this Jev warmth score, a gentle pass is listed for a human look. */
export const SCOLDING_HALF_BELOW = (WARMTH_LEVELS.length - 1) / 2;

export async function jevNoteForTurn(
  asker: JevAsker,
  record: SessionRecord,
  turn: SessionTurn,
  results: readonly CheckResult[],
): Promise<JevNote | null> {
  const verdict = (check: CheckId) => results.find((r) => r.check === check)?.verdict ?? 'n/a';
  const questions: Record<string, JevQuestion> = {};
  if (verdict('no-read-back') !== 'n/a') questions.give_away = GIVE_AWAY_QUESTION;
  if (verdict('gentle') !== 'n/a') questions.warmth = WARMTH_QUESTION;
  if (Object.keys(questions).length === 0) return null;
  const state: JevJson = {
    scene: record.scene,
    level: record.cefr,
    learner: turn.input.type === 'spoke' ? turn.input.text : `(${turn.input.type})`,
    card_french: turn.card?.fr ?? null,
    learner_has_tried: turn.attempted,
    tutor: {
      scene_reply: turn.tutor.sceneReply,
      coach_line: turn.tutor.coachLine ?? null,
      narration: turn.tutor.narration ?? null,
    },
  };
  const { answers } = await asker.systemOne(state, questions);
  const note: JevNote = { turn: `${record.id}#${turn.n}`, giveAway: null, warmth: null, disagreements: [] };
  const give = answers.give_away;
  if (give?.type === 'noul') {
    note.giveAway = give.noul;
    if (verdict('no-read-back') === 'pass' && give.noul >= 0.5) note.disagreements.push(`no-read-back pass, Jev give-away ${give.noul.toFixed(2)}`);
  }
  const warmth = answers.warmth;
  if (warmth?.type === 'score') {
    const level = WARMTH_LEVELS[Math.round(warmth.score)] ?? String(warmth.score);
    note.warmth = level;
    // The score is a position from 0 (scolding) to 3 (warm). Its scolding half is
    // below the midpoint 1.5, so a line Jev rounds to "kind" is not flagged.
    if (verdict('gentle') === 'pass' && warmth.score < SCOLDING_HALF_BELOW) {
      note.disagreements.push(`gentle pass, Jev hears ${level} (${warmth.score.toFixed(2)})`);
    }
  }
  return note;
}

// ---------------------------------------------------------------------------
// Loading, the report, the run
// ---------------------------------------------------------------------------

export function recordPaths(args: readonly string[]): string[] {
  const files: string[] = [];
  let dir: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--dir') dir = args[++i] ?? '';
    else if (arg === '--jev') continue;
    else files.push(arg);
  }
  if (files.length > 0) return files;
  const folder = dir ?? SYNTHETIC_DIR;
  let names: string[];
  try {
    if (!statSync(folder).isDirectory()) return [];
    names = readdirSync(folder);
  } catch {
    return [];
  }
  return names.filter((name) => name.endsWith('.json')).sort().map((name) => path.join(folder, name));
}

const pct = (passed: number, applicable: number): string =>
  applicable === 0 ? '   -' : `${Math.round((passed / applicable) * 100)}%`.padStart(4);

export function reportLines(summary: SessionsSummary, records: readonly SessionRecord[]): string[] {
  const lines = ['', 'check          turns  pass'];
  for (const c of summary.checks) {
    lines.push(`${c.check.padEnd(14)} ${String(c.applicable).padStart(5)}  ${pct(c.passed, c.applicable)}`);
  }
  const failures = summary.checks.flatMap((c) => c.failures.map((f) => ({ ...f, check: c.check })));
  if (failures.length > 0) {
    lines.push('', 'failing turns:');
    for (const f of failures) lines.push(`  FAIL ${f.turn} ${f.check}: ${f.reason}`);
  }
  const waits = replyWaitSummary(records);
  lines.push(
    '',
    waits.count === 0
      ? 'reply wait: no turns carry replyWaitMs'
      : `reply wait over ${waits.count} turns: p50 ${waits.p50}ms, p95 ${waits.p95}ms (measured, no budget set)`,
  );
  lines.push(summary.ok ? 'PASS: every applicable turn kept every rule.' : 'FAIL: at least one turn broke a rule, listed above.');
  return lines;
}

export interface RunOptions {
  args: readonly string[];
  log: (line: string) => void;
  /** Built only when --jev is passed. Null means no TYPESAFE_API_KEY. */
  jev?: () => JevAsker | null;
}

/** 0 every turn passed, 1 a turn failed or input was refused, 2 BLOCKED. */
export async function runSessionEval(options: RunOptions): Promise<number> {
  const { args, log } = options;
  const files = recordPaths(args);
  if (files.length === 0) {
    log('BLOCKED: no session records found, so nothing was scored. Pass --dir <folder> or record files.');
    return 2;
  }
  const records: SessionRecord[] = [];
  for (const file of files) {
    try {
      records.push(parseSessionRecord(JSON.parse(readFileSync(file, 'utf8'))));
    } catch (error) {
      log(`refused ${file}: ${error instanceof Error ? error.message : String(error)}`);
      return 1;
    }
  }
  log(`session eval over ${records.length} records, ${records.reduce((n, r) => n + r.turns.length, 0)} turns`);

  const scores = records.map(scoreSession);
  const summary = summariseSessions(scores);
  for (const line of reportLines(summary, records)) log(line);

  const mismatches = records.flatMap(labelMismatches);
  if (mismatches.length > 0) {
    log('');
    log('hand labels the checks disagree with:');
    for (const line of mismatches) log(`  ${line}`);
  }

  if (args.includes('--jev')) {
    const refused = records.filter((r) => !(SESSION_SOURCES as readonly string[]).includes(r.source));
    if (refused.length > 0) {
      log(`--jev refused: ${refused.map((r) => r.id).join(', ')} is not synthetic or dev, and only those may be sent to TypeSafe.`);
      return 1;
    }
    const asker = options.jev?.() ?? null;
    if (asker === null) {
      log('');
      log('Jev columns skipped: TYPESAFE_API_KEY is not set. The verdicts above stand on their own.');
    } else {
      log('');
      log('Jev, advisory (never changes a verdict):');
      const notes: JevNote[] = [];
      for (const record of records) {
        const score = scoreSession(record);
        for (const [i, turn] of record.turns.entries()) {
          try {
            const results = score.turns[i]?.results ?? [];
            const note = await jevNoteForTurn(asker, record, turn, results);
            if (note === null) continue;
            notes.push(note);
            const v = (check: CheckId) => results.find((r) => r.check === check)?.verdict ?? 'n/a';
            log(
              `  ${note.turn}  no-read-back ${v('no-read-back')} / Jev give-away ${note.giveAway?.toFixed(2) ?? '-'}` +
                `  gentle ${v('gentle')} / Jev warmth ${note.warmth ?? '-'}`,
            );
          } catch (error) {
            log(`  ${record.id}#${turn.n}  Jev did not answer: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      const disagreements = notes.flatMap((n) => n.disagreements.map((d) => `${n.turn} ${d}`));
      log('');
      log(disagreements.length === 0 ? 'Jev agrees with every verdict it was asked about.' : 'for a human look:');
      for (const line of disagreements) log(`  DISAGREE ${line}`);
    }
  }
  return summary.ok ? 0 : 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const code = await runSessionEval({
    args,
    log: (line) => console.log(line),
    jev: args.includes('--jev') ? await jevFromEnv() : () => null,
  });
  process.exitCode = code;
}

async function jevFromEnv(): Promise<() => JevAsker | null> {
  const dotenv = await import('dotenv');
  const envFile = process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../.env', import.meta.url));
  dotenv.config({ path: envFile, override: false, quiet: true });
  const { typeSafeFromEnv } = await import('@luvani/brain/llm');
  return () => typeSafeFromEnv(process.env);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
