/**
 * The live eval: every curated utterance through the real brain, results as a
 * table plus full transcripts for eyeballing.
 *
 * Two kinds of outcome, deliberately separated:
 *   - expectation misses (a kind not detected, a better form that surprised
 *     us) are printed for judgment — models vary, and the founder's eye is
 *     the judge of coaching quality
 *   - hard-rule violations (scolding, hesitation commentary, copy rules) FAIL
 *     the run with a nonzero exit, because those are product commitments
 *
 * The first case runs alone to warm the prompt cache; the rest run in
 * parallel and read it.
 */

import 'dotenv/config';
import process from 'node:process';

import {
  APERO_FRAME,
  CAFE_FRAME,
  AnthropicBrainClient,
  MockLlmClient,
  OpenAiCompatBrainClient,
  applyNonSpokenInput,
  copyViolations,
  createConversation,
  defaultModel,
  integrateTurn,
  prepareTurn,
  type BrainEffort,
  type LearnerTurnInput,
  type LlmClient,
  type LlmUsage,
  type TurnView,
  type TutorTurn,
} from '@parle/brain';
import { STUCK_SILENCE_MS } from '@parle/core';

import { EVAL_CASES, type EvalCase } from './cases.ts';
import { addUsage, costUsd, ZERO_USAGE } from '../usage.ts';

const HESITATION_COMMENTARY = /take your time|don'?t worry|are you still there|no rush|no hurry|it'?s (ok|okay|fine) to/i;

interface CaseResult {
  id: string;
  ok: boolean;
  hardViolations: string[];
  misses: string[];
  kindsFound: string[];
  elapsedMs: number;
  usage: LlmUsage;
  transcript: string[];
}

function pickClient(): { client: LlmClient; label: string } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const rawEffort = (process.env.BRAIN_EFFORT ?? '').toLowerCase();
  const effort = (['low', 'medium', 'high'] as const).includes(rawEffort as BrainEffort)
    ? (rawEffort as BrainEffort)
    : undefined;
  const choice = (process.env.BRAIN_LLM ?? '').toLowerCase();

  if (choice === 'mock') {
    // Pipeline check only: the mock cannot classify anything, so every
    // detection case will report a miss. Hard rules still apply.
    return { client: new MockLlmClient(), label: 'mock (pipeline check only, expect misses)' };
  }
  if ((choice === 'anthropic' || choice === '') && anthropicKey) {
    return {
      client: new AnthropicBrainClient(effort ? { effort } : {}),
      label: `routed: sonnet talker · opus analyst${effort ? ` · ${effort}` : ''}`,
    };
  }
  if ((choice === 'groq' || choice === '') && groqKey) {
    return { client: new OpenAiCompatBrainClient({ apiKey: groqKey }), label: `${defaultModel()} · groq` };
  }
  console.error('The eval needs a real model. Set ANTHROPIC_API_KEY (or GROQ_API_KEY) in services/brain-playground/.env');
  process.exit(2);
}

function inputFor(testCase: EvalCase): LearnerTurnInput {
  if (testCase.input.type === 'silence') return { type: 'silence', durationMs: STUCK_SILENCE_MS };
  return testCase.input;
}

async function runCase(client: LlmClient, testCase: EvalCase): Promise<CaseResult> {
  const frame = testCase.scenario === 'cafe' ? CAFE_FRAME : APERO_FRAME;
  // An A2 snapshot opens at Prompted, so coaching, not scaffolding, is what
  // gets exercised.
  let state = createConversation(
    frame,
    { cefr: 'A2', confidence: 'medium', watchFor: [], lastRung: null, sessions: 0 },
    { strictness: 'balanced', maxTurns: 24 },
  );

  const input = inputFor(testCase);
  let rescued = false;
  if (input.type !== 'spoke') {
    const applied = applyNonSpokenInput(state, input);
    state = applied.state;
    rescued = applied.view.rescued;
  }

  const started = Date.now();
  const { turn, usage } = await client.turn(prepareTurn(state, input));
  const elapsedMs = Date.now() - started;
  const { state: after, view } = integrateTurn(state, input, turn);

  const hardViolations = hardRules(testCase, turn, view);
  const misses = expectationMisses(testCase, turn, view, after.deferred.length, rescued);

  return {
    id: testCase.id,
    ok: hardViolations.length === 0 && misses.length === 0,
    hardViolations,
    misses,
    kindsFound: turn.coach.map((c) => c.kind),
    elapsedMs,
    usage,
    transcript: transcriptOf(testCase, turn, view),
  };
}

function hardRules(testCase: EvalCase, turn: TutorTurn, view: TurnView): string[] {
  const violations: string[] = [];

  if (view.coachLine !== null) {
    for (const rule of copyViolations(view.coachLine)) violations.push(`coachLine breaks ${rule}: "${view.coachLine}"`);
  }
  for (const item of view.coachNow) {
    for (const rule of copyViolations(item.why, { allowDigits: false })) {
      if (item.why.length > 0) violations.push(`why breaks ${rule}: "${item.why}"`);
    }
  }
  const spoken = `${view.sceneReply.fr} ${view.sceneReply.en} ${view.coachLine ?? ''}`;
  if (testCase.input.type !== 'spoke' && HESITATION_COMMENTARY.test(spoken)) {
    violations.push(`hesitation commentary after ${testCase.input.type}: "${spoken}"`);
  }
  if (/—/.test(spoken)) violations.push('em dash reached the learner');

  return violations;
}

function expectationMisses(
  testCase: EvalCase,
  turn: TutorTurn,
  view: TurnView,
  deferredCount: number,
  rescued: boolean,
): string[] {
  const misses: string[] = [];
  const expect = testCase.expect;

  if (expect.kindsAny && !turn.coach.some((c) => expect.kindsAny!.includes(c.kind))) {
    misses.push(`expected one of [${expect.kindsAny.join(', ')}], got [${turn.coach.map((c) => c.kind).join(', ') || 'none'}]`);
  }
  if (expect.betterMatch && !turn.coach.some((c) => expect.betterMatch!.test(c.better))) {
    misses.push(`no better form matching ${expect.betterMatch} (got: ${turn.coach.map((c) => c.better).join(' | ') || 'none'})`);
  }
  if (expect.deferredAtBalanced && !(view.coachNow.length === 0 && deferredCount > 0)) {
    misses.push(`expected deferral at balanced (inline: ${view.coachNow.length}, deferred: ${deferredCount})`);
  }
  if (expect.emptyCoach && turn.coach.some((c) => c.weight === 'matters-now')) {
    misses.push(`expected no matters-now coaching, got [${turn.coach.map((c) => `${c.kind}/${c.weight}`).join(', ')}]`);
  }
  if (expect.language && turn.assessment.language !== expect.language) {
    misses.push(`expected language ${expect.language}, got ${turn.assessment.language}`);
  }
  if (expect.rescue && !rescued) {
    misses.push('expected the pre-model rescue to fire');
  }
  return misses;
}

function transcriptOf(testCase: EvalCase, turn: TutorTurn, view: TurnView): string[] {
  const lines = [
    `learner: ${testCase.input.type === 'spoke' ? testCase.input.text : `[${testCase.input.type}]`}`,
  ];
  if (view.coachLine) lines.push(`coach:   ${view.coachLine}`);
  for (const c of turn.coach) {
    lines.push(`  ${c.kind} (${c.weight}): "${c.quote}" -> "${c.better}" | ${c.why}`);
  }
  lines.push(`${turn.sceneReply.speaker}: ${turn.sceneReply.fr}  (${turn.sceneReply.en})`);
  if (turn.newPhrases.length > 0) {
    lines.push(`taught:  ${turn.newPhrases.map((p) => `${p.fr} [${p.register}]`).join(' · ')}`);
  }
  return lines;
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}

async function main(): Promise<void> {
  const { client, label } = pickClient();
  console.log(`\nRunning ${EVAL_CASES.length} cases against ${label}\n`);

  // Warm the prompt cache with the first case, then fan out.
  const [first, ...rest] = EVAL_CASES;
  const results: CaseResult[] = [await runCase(client, first!)];
  results.push(...(await Promise.all(rest.map((c) => runCase(client, c)))));

  let totals = ZERO_USAGE;
  console.log(`${pad('case', 26)} ${pad('result', 8)} ${pad('kinds found', 34)} ${pad('time', 7)}`);
  console.log('-'.repeat(80));
  for (const r of results) {
    totals = addUsage(totals, r.usage);
    const status = r.hardViolations.length > 0 ? 'FAIL' : r.misses.length > 0 ? 'miss' : 'ok';
    console.log(
      `${pad(r.id, 26)} ${pad(status, 8)} ${pad(r.kindsFound.join(',') || '-', 34)} ${pad(`${(r.elapsedMs / 1000).toFixed(1)}s`, 7)}`,
    );
  }

  console.log(`\nTranscripts\n${'='.repeat(80)}`);
  for (const r of results) {
    console.log(`\n[${r.id}]`);
    for (const line of r.transcript) console.log(`  ${line}`);
    for (const miss of r.misses) console.log(`  ~ miss: ${miss}`);
    for (const violation of r.hardViolations) console.log(`  ! HARD: ${violation}`);
  }

  const hardFailures = results.filter((r) => r.hardViolations.length > 0);
  const misses = results.filter((r) => r.hardViolations.length === 0 && r.misses.length > 0);
  console.log(`\n${'='.repeat(80)}`);
  console.log(
    `${results.length - hardFailures.length - misses.length} ok · ${misses.length} expectation misses (judgment calls, read the transcripts) · ${hardFailures.length} hard failures`,
  );
  console.log(`cost: ~$${costUsd(totals).toFixed(2)} for the run\n`);

  process.exit(hardFailures.length > 0 ? 1 : 0);
}

await main();
