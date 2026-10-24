/**
 * Replay recorded learner inputs against a brain and score what it says back.
 *
 *   npm run eval:replay -w @luvani/brain-playground -- --provider mock
 *   npm run eval:replay -w @luvani/brain-playground -- --provider openai --repeat 3
 *   npm run eval:replay -w @luvani/brain-playground -- --dir <folder> | <record.json> ...
 *
 * The session eval (sessionEval.ts) scores tutor lines somebody already
 * recorded. This one keeps only the learner's side of each record, runs it
 * through the real brain loop (createConversation, applyNonSpokenInput,
 * prepareTurn, client.turn, integrateTurn), builds a NEW record of what the
 * model said this time with the same builder `chat --record` uses (devRecord.ts),
 * and scores it with the same five checks. The recorded tutor lines and the
 * hand labels in synthetic records are not used: they describe the old lines.
 *
 * ## What it reports, per provider
 *
 * Model turns (the turns the brain answered), accepted model turns (a model
 * turn that passes every check that applies to it), acceptance, failures by
 * check, total cost, COST PER ACCEPTED TURN, and the brain's latency p50 and
 * p95. Cost per accepted turn is the number to compare providers on: a cheap
 * model that fails the rules half the time costs twice what its price says. It
 * is a measurement. No threshold is set, so a run that completes exits 0
 * whatever the acceptance was.
 *
 * ## Only the brain's turns are judged
 *
 * Two kinds of turn are code, identical for every vendor, and the live tutor
 * never asks the brain for them:
 *
 *   quiet first rescue  The first silence or aide-moi of an exchange that shows a
 *                       hint (`isQuietRescue`, from services/tutor-agent/src/
 *                       convo.ts `rescue()`). The hint renders and nothing is said.
 *   safety step         A spoken line `safetyDecision` flags
 *                       (services/tutor-agent/src/safety.ts). The tutor says the
 *                       fixed policy message with no brain call
 *                       (convo.ts `handleSafety`, run before the brain turn). A
 *                       'stop' decision closes the session, so the rest of that
 *                       record is not replayed and is counted as unreplayed.
 *
 * Both are replayed the way the product does them: no client call, no cost, no
 * latency. Both are still scored and any failure is still listed, so a code
 * regression shows. But they are left out of acceptance and cost per accepted
 * turn, so they cannot lift one vendor's acceptance or dilute its cost. They are
 * printed as their own counts.
 *
 * ## Which frame a scene id replays on
 *
 * The brain exports two hand-written frames and the mission frames, and a
 * record names its scene with a plain id:
 *
 *   starts with `apero`        APERO_FRAME  (apero-bar, apero-friends)
 *   starts with `cafe`         CAFE_FRAME   (cafe-order, cafe-tea, cafe-terrace, cafe-safety)
 *   `mission:<name>`           that mission's frame in MISSION_FRAMES
 *   anything else (bakery ...) CAFE_FRAME, with a printed note
 *
 * A scene with no frame of its own replays on the café, so its replies are
 * scored against the right rules for the learner's inputs but in the wrong shop.
 * The note says so, per record.
 *
 * ## Lessons are skipped
 *
 * A `lesson` record is scripted (services/tutor-agent/src/scriptedSpeech.ts), so
 * there is no brain loop to replay it through. It is skipped with a note, makes no
 * model call and adds no turn. A replayed record keeps its source record's mode.
 *
 * ## Credentials
 * *
 * `--provider mock` uses MockLlmClient: a pipeline check only, it says the same
 * canned line every turn and costs nothing. A real provider needs its key
 * (OPENAI_API_KEY, ANTHROPIC_API_KEY or GROQ_API_KEY); without it this prints
 * BLOCKED and exits 2. With no --provider, the first provider with a key is used,
 * as curationEval.ts picks one.
 *
 * Exit codes: 0 ran, 1 input refused or nothing could be replayed, 2 BLOCKED.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  APERO_FRAME,
  AnthropicBrainClient,
  CAFE_FRAME,
  MISSION_FRAMES,
  MockLlmClient,
  OpenAiCompatBrainClient,
  OpenAiResponsesBrainClient,
  applyNonSpokenInput,
  createConversation,
  defaultModel,
  integrateTurn,
  prepareTurn,
  type CefrBand,
  type LlmClient,
  type LlmUsage,
  type ScenarioFrame,
  type SupportView,
} from '@luvani/brain';

import { addUsage, evalCostUsd, ZERO_USAGE } from '../usage.ts';
import { safetyDecision } from '@luvani/tutor-agent/src/safety.ts';

import { missingCredentials, pickProvider, CREDENTIAL_ENV, type Environment } from './curationEval.ts';
import { SILENT_TUTOR, isQuietRescue, newRecorder, recordTurn, safetyTutor, toSessionRecord, tutorLinesFromView } from './devRecord.ts';
import { openAiEvalModel } from './openaiEval.ts';
import { replyWaitSummary } from './sessionChecks.ts';
import { recordPaths, scoreSession, summariseSessions, type CheckSummary } from './sessionEval.ts';
import { CHECK_IDS, parseSessionRecord, type SessionRecord } from './sessionRecord.ts';

export const REPLAY_PROVIDERS = ['openai', 'anthropic', 'groq', 'mock'] as const;
export type ReplayProvider = (typeof REPLAY_PROVIDERS)[number];

const KEY_OF = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', groq: 'GROQ_API_KEY' } as const;

const CEFR_BANDS: readonly string[] = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** The frame a record's scene id replays on, and a note when it is a stand-in. */
export function frameForScene(scene: string): { frame: ScenarioFrame; note: string | null } {
  if (scene.startsWith('mission:')) {
    const mission = (MISSION_FRAMES as Record<string, ScenarioFrame | undefined>)[scene];
    if (mission !== undefined) return { frame: mission, note: null };
  }
  if (scene.startsWith('apero')) return { frame: APERO_FRAME, note: null };
  if (scene.startsWith('cafe')) return { frame: CAFE_FRAME, note: null };
  return { frame: CAFE_FRAME, note: `scene "${scene}" has no frame of its own, replayed on the café` };
}

export type TurnKind = 'model' | 'quiet-rescue' | 'safety';

export interface ReplayedSession {
  /** The new record of what the model said, or null when no turn was recorded. */
  record: SessionRecord | null;
  usage: LlmUsage;
  /** Calls to client.turn that returned. */
  modelCalls: number;
  /** First rescues answered with a hint and no model call. */
  quietRescues: number;
  /** Spoken lines the safety layer answered, with no model call. */
  safetyTurns: number;
  /** What produced each turn of `record`, in order. Only 'model' turns are judged. */
  kinds: TurnKind[];
  /** Model turns that threw. They add no turn to the record. */
  failedTurns: number;
  /** Recorded inputs not replayed because the replayed scene ended first. */
  unreplayedInputs: number;
  notes: string[];
}

/** Replay one record's learner inputs through the brain loop. */
export async function replayRecord(record: SessionRecord, client: LlmClient, run: number, label: string): Promise<ReplayedSession> {
  // A lesson is scripted (scriptedSpeech.ts), so there is no brain loop to run
  // its inputs through. Skipped with no model call and no turn to score.
  if (record.mode === 'lesson') {
    return {
      record: null,
      usage: ZERO_USAGE,
      modelCalls: 0,
      quietRescues: 0,
      safetyTurns: 0,
      kinds: [],
      failedTurns: 0,
      unreplayedInputs: 0,
      notes: [`${record.id}: a lesson is scripted, there is no brain loop to replay`],
    };
  }
  const { frame, note } = frameForScene(record.scene);
  const notes = note === null ? [] : [`${record.id}: ${note}`];
  const cefr: CefrBand = CEFR_BANDS.includes(record.cefr) ? (record.cefr as CefrBand) : 'A1';
  if (cefr !== record.cefr) notes.push(`${record.id}: cefr "${record.cefr}" is not a band, replayed as A1`);

  let state = createConversation(
    frame,
    { cefr, confidence: 'medium', watchFor: [], lastRung: null, sessions: 0, name: null },
    { strictness: 'balanced', maxTurns: Math.max(24, record.turns.length + 2) },
  );
  let recorder = newRecorder({
    id: `${record.id}@${label}${run > 1 ? `#${run}` : ''}`,
    scene: record.scene,
    mode: record.mode,
    cefr: record.cefr,
  });
  let usage = ZERO_USAGE;
  let modelCalls = 0;
  let quietRescues = 0;
  let safetyTurns = 0;
  const kinds: TurnKind[] = [];
  let failedTurns = 0;
  let unreplayedInputs = 0;

  for (const [index, recorded] of record.turns.entries()) {
    const input = recorded.input;
    const beat = state.currentBeat;
    const targetFr = state.lastSupport.fullLine.fr;
    const depthBefore = state.assistanceDepth;

    // The live tutor checks safety before it asks the brain (convo.ts handleSafety).
    const decision = input.type === 'spoke' ? safetyDecision(input.text) : null;
    if (decision !== null) {
      safetyTurns += 1;
      kinds.push('safety');
      recorder = recordTurn(recorder, {
        beat,
        input,
        rung: state.ladder.rung,
        support: null,
        targetFr,
        rescued: false,
        tutor: safetyTutor(decision.message),
        safetyStep: true,
      });
      if (decision.action === 'stop') {
        unreplayedInputs = record.turns.length - index - 1;
        break;
      }
      continue;
    }

    let rescued = false;
    let support: SupportView | null = null;
    if (input.type !== 'spoke') {
      const applied = applyNonSpokenInput(state, input);
      state = applied.state;
      rescued = applied.view.rescued;
      support = applied.view.supportView;
    }
    const rung = state.ladder.rung;

    if (support !== null && isQuietRescue(depthBefore, support)) {
      quietRescues += 1;
      kinds.push('quiet-rescue');
      recorder = recordTurn(recorder, { beat, input, rung, support, targetFr, rescued, tutor: SILENT_TUTOR });
      continue;
    }

    const started = Date.now();
    try {
      const result = await client.turn(prepareTurn(state, input));
      const elapsedMs = Date.now() - started;
      usage = addUsage(usage, result.usage);
      modelCalls += 1;
      kinds.push('model');
      const integrated = integrateTurn(state, input, result.turn);
      state = integrated.state;
      recorder = recordTurn(recorder, {
        beat,
        input,
        rung,
        support,
        targetFr,
        rescued,
        tutor: tutorLinesFromView(integrated.view),
        replyWaitMs: elapsedMs,
      });
      if (integrated.view.recapDue) {
        unreplayedInputs = record.turns.length - index - 1;
        break;
      }
    } catch (error) {
      failedTurns += 1;
      notes.push(`${record.id}#${recorded.n}: the model turn failed (${error instanceof Error ? error.message : String(error)})`);
      recorder = recordTurn(recorder, { beat, input, rung, support, targetFr, rescued, tutor: null });
    }
  }

  return {
    record: recorder.turns.length === 0 ? null : toSessionRecord(recorder),
    usage,
    modelCalls,
    quietRescues,
    safetyTurns,
    kinds,
    failedTurns,
    unreplayedInputs,
    notes,
  };
}

export interface ReplayReport {
  label: string;
  costModel: string;
  records: number;
  runs: number;
  /** Every scored turn: model turns, quiet rescues and safety steps. */
  turns: number;
  /** Turns the brain answered. Acceptance and cost are over these only. */
  modelTurns: number;
  acceptedModelTurns: number;
  /** acceptedModelTurns / modelTurns, or null with no model turns. */
  acceptance: number | null;
  checks: CheckSummary[];
  usage: LlmUsage;
  modelCalls: number;
  quietRescues: number;
  safetyTurns: number;
  failedTurns: number;
  unreplayedInputs: number;
  costUsd: number;
  /** costUsd / acceptedModelTurns. Null when none was accepted: dividing by zero would print a number that means nothing. */
  costPerAcceptedTurn: number | null;
  latency: { count: number; p50: number | null; p95: number | null };
  notes: string[];
}

export interface ReplayRequest {
  records: readonly SessionRecord[];
  client: LlmClient;
  costModel: string;
  /** Names the provider in the report and in replayed record ids. */
  label: string;
  repeat?: number;
}

/** Replay every record `repeat` times against one client and total the result. */
export async function replayRecords(request: ReplayRequest): Promise<ReplayReport> {
  const repeat = Math.max(1, Math.floor(request.repeat ?? 1));
  const replayed: SessionRecord[] = [];
  const kindsOf: TurnKind[][] = [];
  let usage = ZERO_USAGE;
  let modelCalls = 0;
  let quietRescues = 0;
  let safetyTurns = 0;
  let failedTurns = 0;
  let unreplayedInputs = 0;
  const notes: string[] = [];

  for (let run = 1; run <= repeat; run += 1) {
    for (const record of request.records) {
      const session = await replayRecord(record, request.client, run, request.label);
      if (session.record !== null) {
        replayed.push(session.record);
        kindsOf.push(session.kinds);
      }
      usage = addUsage(usage, session.usage);
      modelCalls += session.modelCalls;
      quietRescues += session.quietRescues;
      safetyTurns += session.safetyTurns;
      failedTurns += session.failedTurns;
      unreplayedInputs += session.unreplayedInputs;
      // The same note on every repeat says nothing new.
      for (const note of session.notes) if (!notes.includes(note)) notes.push(note);
    }
  }

  const scores = replayed.map(scoreSession);
  const summary = summariseSessions(scores);
  const turns = scores.reduce((n, s) => n + s.turns.length, 0);
  let modelTurns = 0;
  let acceptedModelTurns = 0;
  for (const [i, score] of scores.entries()) {
    for (const [j, scored] of score.turns.entries()) {
      if (kindsOf[i]?.[j] !== 'model') continue;
      modelTurns += 1;
      if (scored.results.every((r) => r.verdict !== 'fail')) acceptedModelTurns += 1;
    }
  }
  const costUsd = evalCostUsd(usage, request.costModel);
  return {
    label: request.label,
    costModel: request.costModel,
    records: request.records.length,
    runs: repeat,
    turns,
    modelTurns,
    acceptedModelTurns,
    acceptance: modelTurns === 0 ? null : acceptedModelTurns / modelTurns,
    checks: summary.checks,
    usage,
    modelCalls,
    quietRescues,
    safetyTurns,
    failedTurns,
    unreplayedInputs,
    costUsd,
    costPerAcceptedTurn: acceptedModelTurns === 0 ? null : costUsd / acceptedModelTurns,
    latency: replyWaitSummary(replayed),
    notes,
  };
}

const usd = (n: number): string => `$${n.toFixed(4)}`;

export function replayReportLines(report: ReplayReport): string[] {
  const lines = [
    '',
    `replay on ${report.label} (priced as ${report.costModel}): ${report.records} records x ${report.runs} run${report.runs === 1 ? '' : 's'}`,
    `turns replayed: ${report.turns}: ${report.modelTurns} answered by the brain, ${report.quietRescues} quiet first rescues and ${report.safetyTurns} safety steps (code, no model call)`,
    `model calls: ${report.modelCalls}, model turns that failed: ${report.failedTurns}`,
  ];
  if (report.unreplayedInputs > 0) {
    lines.push(`${report.unreplayedInputs} recorded inputs were not replayed because the replayed scene ended before them`);
  }
  lines.push('', 'check          turns  failed   (all turns, code turns included)');
  for (const c of report.checks) {
    lines.push(`${c.check.padEnd(14)} ${String(c.applicable).padStart(5)}  ${String(c.failures.length).padStart(6)}`);
  }
  const failures = report.checks.flatMap((c) => c.failures.map((f) => ({ ...f, check: c.check })));
  if (failures.length > 0) {
    lines.push('', 'failing turns:');
    for (const f of failures) lines.push(`  FAIL ${f.turn} ${f.check}: ${f.reason}`);
  }
  lines.push(
    '',
    report.acceptance === null
      ? 'acceptance: the brain answered no turns'
      : `acceptance: ${report.acceptedModelTurns} of ${report.modelTurns} brain turns passed every check that applied (${Math.round(report.acceptance * 100)}%)`,
    `cost: ${usd(report.costUsd)} in total`,
    report.costPerAcceptedTurn === null
      ? 'cost per accepted turn: no accepted brain turns, so there is no figure to give'
      : `cost per accepted turn: ${usd(report.costPerAcceptedTurn)}`,
    report.latency.count === 0
      ? 'brain latency: no model call was timed'
      : `brain latency over ${report.latency.count} model calls: p50 ${report.latency.p50}ms, p95 ${report.latency.p95}ms (measured, no budget set)`,
  );
  if (report.notes.length > 0) {
    lines.push('', 'notes:');
    for (const note of report.notes) lines.push(`  ${note}`);
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Providers and the run
// ---------------------------------------------------------------------------

/** The model a run is priced on: what the provider's client really sends turns to. */
export function replayCostModel(provider: ReplayProvider, env: Environment): string {
  if (provider === 'openai' || provider === 'mock') return openAiEvalModel('turn', env);
  return provider === 'anthropic' ? 'claude-sonnet-5' : defaultModel(env);
}

function buildReplayClient(provider: ReplayProvider, env: Environment): LlmClient {
  if (provider === 'mock') return new MockLlmClient();
  const apiKey = env[KEY_OF[provider]] ?? '';
  if (provider === 'openai') return new OpenAiResponsesBrainClient({ apiKey });
  if (provider === 'anthropic') return new AnthropicBrainClient({ apiKey });
  return new OpenAiCompatBrainClient({ apiKey });
}

export interface ReplayArgs {
  provider: string | null;
  repeat: number;
  /** What is left for recordPaths: --dir and its value, and file paths. */
  recordArgs: string[];
  error: string | null;
}

export function parseReplayArgs(args: readonly string[]): ReplayArgs {
  const parsed: ReplayArgs = { provider: null, repeat: 1, recordArgs: [], error: null };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] as string;
    if (arg === '--provider') parsed.provider = args[++i] ?? '';
    else if (arg === '--repeat') {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 1) parsed.error = '--repeat needs a whole number of 1 or more';
      else parsed.repeat = n;
    } else if (arg === '--dir') parsed.recordArgs.push(arg, args[++i] ?? '');
    else parsed.recordArgs.push(arg);
  }
  return parsed;
}

export interface ReplayRunOptions {
  args: readonly string[];
  env: Environment;
  log: (line: string) => void;
}

/** 0 ran, 1 input refused or nothing replayed, 2 BLOCKED. */
export async function runReplayEval(options: ReplayRunOptions): Promise<number> {
  const { env, log } = options;
  const parsed = parseReplayArgs(options.args);
  if (parsed.error !== null) {
    log(parsed.error);
    return 1;
  }

  let provider: ReplayProvider;
  if (parsed.provider !== null) {
    if (!(REPLAY_PROVIDERS as readonly string[]).includes(parsed.provider)) {
      log(`unknown provider "${parsed.provider}". Use one of ${REPLAY_PROVIDERS.join(', ')}.`);
      return 1;
    }
    provider = parsed.provider as ReplayProvider;
    if (provider !== 'mock') {
      const key = KEY_OF[provider];
      if ((env[key] ?? '').trim() === '') {
        log(`BLOCKED: ${key} is not set, so nothing was replayed on ${provider}.`);
        log('Put it in services/brain-playground/.env and run this again, or use --provider mock for a pipeline check.');
        return 2;
      }
    }
  } else {
    const missing = missingCredentials(env);
    const picked = pickProvider(env);
    if (missing.length > 0 || picked === null) {
      log(`BLOCKED: none of ${CREDENTIAL_ENV.join(', ')} is set, so nothing was replayed.`);
      log('Put one in services/brain-playground/.env, or use --provider mock for a pipeline check.');
      return 2;
    }
    provider = picked;
  }

  const files = recordPaths(parsed.recordArgs);
  if (files.length === 0) {
    log('BLOCKED: no session records found, so nothing was replayed. Pass --dir <folder> or record files.');
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

  const client = buildReplayClient(provider, env);
  const report = await replayRecords({
    records,
    client,
    costModel: replayCostModel(provider, env),
    label: provider,
    repeat: parsed.repeat,
  });
  if (provider === 'mock') log('mock client: a pipeline check. It says one canned line every turn, so the scores below say nothing about a model.');
  for (const line of replayReportLines(report)) log(line);
  if (report.turns === 0) {
    log('FAIL: no turn was replayed.');
    return 1;
  }
  return 0;
}

async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  // The playground's own env file, so a test can point LUVANI_ENV_FILE somewhere
  // empty and prove the blocked path without borrowing this machine's keys.
  const envFile = process.env.LUVANI_ENV_FILE ?? fileURLToPath(new URL('../../.env', import.meta.url));
  dotenv.config({ path: envFile, override: false, quiet: true });
  process.exitCode = await runReplayEval({ args: process.argv.slice(2), env: process.env, log: (line) => console.log(line) });
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  await main();
}
