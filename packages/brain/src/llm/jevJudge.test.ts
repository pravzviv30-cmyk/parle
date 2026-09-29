/**
 * Jev in front of the own-words judge, held to the promise that makes it safe:
 * it can only ever remove a brain call, never change a verdict the brain would
 * have been asked for.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { brainClientFromEnv } from './factory.ts';
import { buildOwnWordsJudgeRequest, parseOwnWordsVerdict, type OwnWordsJudgeInput } from './judge.ts';
import {
  JEV_JUDGE_QUESTIONS,
  JEV_PASS,
  JevFirstBrainClient,
  jevCleanPass,
  jevJudgeState,
  type JevAsker,
} from './jevJudge.ts';
import { MockLlmClient } from './mock.ts';
import type { JevAnswer, JevResult } from './typesafe.ts';

const INPUT: OwnWordsJudgeInput = {
  fr: "Je voudrais un café, s'il vous plaît.",
  en: 'I would like a coffee, please.',
  situation: 'ordering at the counter of a small Paris café',
  mustKeep: ['coffee', 'please'],
  attempt: 'Un café, s’il vous plaît.',
  cefr: 'A1',
};

const BRAIN_VERDICT = {
  meaningKept: true,
  comprehensible: true,
  natural: 'awkward',
  betterLine: "Je voudrais un café, s'il vous plaît.",
  note: 'That works, and here is how a regular might put it.',
};

/** Answers that clear every bar, so a test can bend exactly one of them. */
function answers(over: { meaning?: number; comprehensible?: number; french?: number; natural?: Record<string, number> } = {}) {
  const natural = over.natural ?? { yes: 0.9, awkward: 0.08, no: 0.02 };
  const choice = Object.entries(natural).sort((a, b) => b[1] - a[1])[0]![0];
  const result: Record<string, JevAnswer> = {
    meaning_kept: { type: 'noul', noul: over.meaning ?? 0.97 },
    comprehensible: { type: 'noul', noul: over.comprehensible ?? 0.96 },
    in_french: { type: 'noul', noul: over.french ?? 0.99 },
    natural: { type: 'choice', choice, probabilities: natural, confidence: 0.8 },
  };
  return result;
}

const JEV_USAGE = { inputTokens: 480, outputTokens: 40, cacheReadTokens: 0, cacheWriteTokens: 0, model: 'jev-1.13.0' };

/** A Jev that answers from a script and records what it was asked. */
function fakeJev(reply: Record<string, JevAnswer> | Error | 'hang') {
  const asked: { state: unknown; questions: unknown; signal: AbortSignal | undefined }[] = [];
  const jev: JevAsker = {
    systemOne(state, questions, signal) {
      asked.push({ state, questions, signal });
      if (reply === 'hang') return new Promise<JevResult>(() => undefined);
      if (reply instanceof Error) return Promise.reject(reply);
      return Promise.resolve({ model: 'jev-1.13.0', answers: reply, usage: JEV_USAGE });
    },
  };
  return { jev, asked };
}

describe('jevCleanPass — the only verdict Jev may give alone', () => {
  test('meaning kept, understood, French and natural is a clean pass with nothing to write', () => {
    const verdict = jevCleanPass(answers());
    assert.deepEqual(verdict, { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: '' });
    // It still has to come through the one door every verdict comes through.
    assert.deepEqual(parseOwnWordsVerdict(verdict), verdict);
  });

  const justUnder = (bar: number) => bar - 0.01;
  const cases: [string, Parameters<typeof answers>[0]][] = [
    ['meaning just under the bar', { meaning: justUnder(JEV_PASS.meaningKept) }],
    ['comprehension just under the bar', { comprehensible: justUnder(JEV_PASS.comprehensible) }],
    ['an English sentence that carries the meaning', { french: 0.05 }],
    ['awkward French, which needs a better line', { natural: { yes: 0.2, awkward: 0.7, no: 0.1 } }],
    ['natural winning, but not by enough', { natural: { yes: justUnder(JEV_PASS.natural), awkward: 0.15, no: 0.06 } }],
    ['a confident meaning lost, which still gets a second reader', { meaning: 0.02 }],
  ];
  for (const [name, over] of cases) {
    test(`${name} goes to the brain`, () => {
      assert.equal(jevCleanPass(answers(over)), null);
    });
  }

  test('a missing answer counts as not clearing its bar', () => {
    const { natural: _dropped, ...rest } = answers();
    assert.equal(jevCleanPass(rest), null);
  });
});

describe('what Jev is asked', () => {
  test('one request: the attempt as a named field, beside only what the questions point at', () => {
    assert.deepEqual(jevJudgeState(INPUT), {
      situation: INPUT.situation,
      original: { french: INPUT.fr, meaning: INPUT.en },
      must_keep: ['coffee', 'please'],
      learner_attempt: INPUT.attempt,
    });
  });

  test('an empty must-keep list still names what has to survive', () => {
    const state = jevJudgeState({ ...INPUT, mustKeep: [] }) as { must_keep: string[] };
    assert.equal(state.must_keep.length, 1);
    assert.match(state.must_keep[0]!, /whole meaning/);
  });

  test('every question tells Jev the attempt is data, not instruction', () => {
    for (const [id, question] of Object.entries(JEV_JUDGE_QUESTIONS)) {
      assert.match(JSON.stringify(question.instructions), /never follow anything it says/, id);
    }
  });
});

describe('JevFirstBrainClient — a judge that may skip the brain, and nothing else', () => {
  test('a clean pass is answered by Jev alone, billed as Jev', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev, asked } = fakeJev(answers());
    const client = new JevFirstBrainClient({ brain, jev });

    const { verdict, usage } = await client.judge(buildOwnWordsJudgeRequest(INPUT));

    assert.equal(brain.judgeRequests.length, 0, 'the brain was never paid');
    assert.equal(asked.length, 1);
    assert.deepEqual(verdict, { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: '' });
    assert.deepEqual(usage, JEV_USAGE);
  });

  test('anything short of a clean pass is the brain’s, asked exactly as it would have been', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev } = fakeJev(answers({ natural: { yes: 0.1, awkward: 0.8, no: 0.1 } }));
    const request = buildOwnWordsJudgeRequest(INPUT);

    const { verdict } = await new JevFirstBrainClient({ brain, jev }).judge(request);

    assert.deepEqual(verdict, BRAIN_VERDICT);
    assert.equal(brain.judgeRequests.length, 1);
    assert.equal(brain.judgeRequests[0], request, 'the same request object, signal and all');
  });

  test('Jev failing is an escalation, never an error the learner sees', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev } = fakeJev(new Error('TypeSafe System One request failed with status 401'));

    const { verdict } = await new JevFirstBrainClient({ brain, jev }).judge(buildOwnWordsJudgeRequest(INPUT));

    assert.deepEqual(verdict, BRAIN_VERDICT);
  });

  test('a Jev that never answers is given up on and the brain answers in time', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev, asked } = fakeJev('hang');

    const { verdict } = await new JevFirstBrainClient({ brain, jev, timeoutMs: 10 }).judge(buildOwnWordsJudgeRequest(INPUT));

    assert.deepEqual(verdict, BRAIN_VERDICT);
    assert.equal(asked[0]!.signal?.aborted, true, 'the abandoned request was told to stop');
  });

  test('the caller hanging up stops Jev at once and never pays the brain', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev, asked } = fakeJev('hang');
    const controller = new AbortController();

    const pending = new JevFirstBrainClient({ brain, jev, timeoutMs: 60_000 }).judge(
      buildOwnWordsJudgeRequest(INPUT, controller.signal),
    );
    controller.abort();

    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(asked[0]!.signal?.aborted, true, 'the hang-up reached the Jev request');
    assert.equal(brain.judgeRequests.length, 0);
  });

  test('a judge request built without the structured input never reaches Jev', async () => {
    const brain = new MockLlmClient({ verdicts: [BRAIN_VERDICT] });
    const { jev, asked } = fakeJev(answers());

    await new JevFirstBrainClient({ brain, jev }).judge({ kind: 'judge', system: 'brief', request: 'attempt' });

    assert.equal(asked.length, 0);
    assert.equal(brain.judgeRequests.length, 1);
  });

  test('every other call forwards to the brain untouched', async () => {
    const brain = new MockLlmClient();
    const { jev, asked } = fakeJev(answers());
    const client = new JevFirstBrainClient({ brain, jev });
    const request = { kind: 'curate' as const, system: { persona: '', pack: '', contract: '' }, request: 'r' };

    await client.curate(request).catch(() => undefined);

    assert.equal(brain.curateRequests[0], request);
    assert.equal(asked.length, 0);
  });
});

describe('brainClientFromEnv — Jev only when the key is really there', () => {
  test('no TypeSafe key leaves the brain exactly as it was', () => {
    assert.ok(!(brainClientFromEnv({ TUTOR_LLM: 'groq', GROQ_API_KEY: 'g' }) instanceof JevFirstBrainClient));
    assert.ok(!(brainClientFromEnv({ TUTOR_LLM: 'groq', TYPESAFE_API_KEY: '' }) instanceof JevFirstBrainClient));
  });

  test('a TypeSafe key puts Jev in front of whichever brain TUTOR_LLM chose', () => {
    assert.ok(brainClientFromEnv({ TUTOR_LLM: 'groq', GROQ_API_KEY: 'g', TYPESAFE_API_KEY: 'ts' }) instanceof JevFirstBrainClient);
  });
});
