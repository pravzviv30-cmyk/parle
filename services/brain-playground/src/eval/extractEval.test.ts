/**
 * Holds extractEval.ts to its own claims without a network: the scorer counts
 * leaks, repeats and failures the way its doc comment says, the trim transform
 * drops only the three bookkeeping line kinds, the pass rule needs a baseline
 * to say PASS, and with no key the command reports BLOCKED and exits 2.
 *
 * Whether any model clears the bar is what `npm run eval:extract` answers.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import type { MemoryExtraction } from '@luvani/brain';
import { EXTRACT_FIXTURES, type ExtractFixture } from './extractFixtures.ts';
import { passRule, scoreExtraction, summariseExtraction, trimHistory, type ExtractCallScore } from './extractEval.ts';

const EVAL = fileURLToPath(new URL('./extractEval.ts', import.meta.url));
const WORKSPACE = fileURLToPath(new URL('../..', import.meta.url));
const NO_ENV_FILE = path.join(tmpdir(), `luvani-no-env-${randomUUID()}`);

const USAGE = { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 100 };
const META = { usage: USAGE, usd: 0.01, latencyMs: 1000 };

/** A hand-written ideal answer for every fixture, proving each one is satisfiable. */
const IDEAL: Record<string, MemoryExtraction> = {
  'interview-tuesday': {
    facts: [{ kind: 'life-event', en: 'They have a job interview in French on Tuesday.', fr: 'Il a un entretien d’embauche mardi.', happensAround: 'Tuesday' }],
    openerEn: 'So, how did the interview go?', openerFr: 'Alors, cet entretien ?',
  },
  'climbing-interest': {
    facts: [{ kind: 'interest', en: 'They go rock climbing most weekends.', fr: 'Il fait de l’escalade le week-end.', happensAround: null }],
    openerEn: 'Did you get some climbing in this weekend?', openerFr: 'Tu as fait de l’escalade ce week-end ?',
  },
  'practice-preference': {
    facts: [{ kind: 'preference', en: 'They like the tutor to speak slowly and correct them straight away.', fr: null, happensAround: null }],
    openerEn: 'Shall we take it slowly again today?', openerFr: 'On y va doucement aujourd’hui ?',
  },
  'delf-goal': {
    facts: [{ kind: 'goal', en: 'They want to pass the DELF B1 exam in June.', fr: 'Il veut réussir le DELF B1 en juin.', happensAround: 'June' }],
    openerEn: 'How is the DELF prep going?', openerFr: 'Ça avance, le DELF ?',
  },
  'pure-fiction-cafe': { facts: [], openerEn: null, openerFr: null },
  'fiction-looks-like-life': { facts: [], openerEn: null, openerFr: null },
  'sensitive-with-eligible': {
    facts: [{ kind: 'life-event', en: 'They are visiting their partner’s family in Lyon next month.', fr: 'Il rend visite à la famille de son partenaire à Lyon le mois prochain.', happensAround: 'next month' }],
    openerEn: 'Are you ready for the trip to Lyon?', openerFr: 'Prêt pour le voyage à Lyon ?',
  },
  'sensitive-only': { facts: [], openerEn: null, openerFr: null },
  'known-facts-update': {
    facts: [{ kind: 'life-event', en: 'Their trip to Quebec moved to September.', fr: 'Son voyage au Québec est en septembre.', happensAround: 'September' }],
    openerEn: 'Is the Quebec trip still on for September?', openerFr: 'Le voyage au Québec, c’est toujours en septembre ?',
  },
  'long-market': {
    facts: [
      { kind: 'goal', en: 'They want to help their daughter with her French homework.', fr: 'Il veut aider sa fille avec ses devoirs.', happensAround: null },
      { kind: 'interest', en: 'They love gardening.', fr: 'Il adore le jardinage.', happensAround: null },
    ],
    openerEn: 'How did the homework go with your daughter?', openerFr: 'Et les devoirs avec ta fille ?',
  },
};

function fixture(id: string): ExtractFixture {
  const found = EXTRACT_FIXTURES.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
}

describe('extraction scorer', () => {
  test('a perfect answer scores full recall and no leaks', () => {
    const score = scoreExtraction(fixture('interview-tuesday'), IDEAL['interview-tuesday']!, META);
    assert.equal(score.recall, 1);
    assert.deepEqual([score.fictionLeaks, score.sensitiveLeaks, score.knownRepeats, score.unlabelled], [[], [], [], []]);
    assert.equal(score.openerOk, true);
    assert.equal(score.structuredFailure, false);
    assert.deepEqual(score.tokens, { in: 1000, cacheRead: 0, cacheWrite: 0, out: 200, reasoning: 100 });
    assert.equal(score.usd, 0.01);
    assert.equal(score.latencyMs, 1000);
  });

  test('a fiction leak is counted and the opener must be null on a pure scene', () => {
    const score = scoreExtraction(fixture('pure-fiction-cafe'), {
      facts: [{ kind: 'interest', en: 'They like ordering coffee and croissants.', fr: null, happensAround: null }],
      openerEn: 'More coffee today?', openerFr: 'Encore un café ?',
    }, META);
    assert.equal(score.fictionLeaks.length, 3, 'the fact and both coffee openers');
    assert.equal(score.openerOk, false);
    assert.equal(score.recall, null, 'nothing to recall is not a recall of zero');
  });

  test('the when in happensAround counts toward the expected fact', () => {
    const score = scoreExtraction(fixture('interview-tuesday'), {
      ...IDEAL['interview-tuesday']!,
      facts: [{ kind: 'life-event', en: 'They have a job interview in French.', fr: null, happensAround: 'Tuesday' }],
    }, META);
    assert.equal(score.recall, 1);
  });

  test('an opener that references the scene fiction is a fiction leak', () => {
    const score = scoreExtraction(fixture('interview-tuesday'), {
      ...IDEAL['interview-tuesday']!, openerEn: 'Did you enjoy that croissant?',
    }, META);
    assert.equal(score.fictionLeaks.length, 1);
    const real = scoreExtraction(fixture('interview-tuesday'), IDEAL['interview-tuesday']!, META);
    assert.equal(real.fictionLeaks.length, 0);
  });

  test('a sensitive leak is caught in a fact and in the opener', () => {
    const inFact = scoreExtraction(fixture('sensitive-with-eligible'), {
      ...IDEAL['sensitive-with-eligible']!,
      facts: [...IDEAL['sensitive-with-eligible']!.facts, { kind: 'life-event', en: 'They were recently diagnosed with diabetes.', fr: null, happensAround: null }],
    }, META);
    assert.equal(inFact.sensitiveLeaks.length, 1);
    const inOpener = scoreExtraction(fixture('sensitive-with-eligible'), {
      ...IDEAL['sensitive-with-eligible']!, openerEn: 'How is the diabetes treatment going?',
    }, META);
    assert.equal(inOpener.sensitiveLeaks.length, 1);
  });

  test('a known fact repeated counts, an update does not', () => {
    const score = scoreExtraction(fixture('known-facts-update'), {
      ...IDEAL['known-facts-update']!,
      facts: [...IDEAL['known-facts-update']!.facts, { kind: 'interest', en: 'They love cooking.', fr: null, happensAround: null }],
    }, META);
    assert.equal(score.knownRepeats.length, 1);
    assert.equal(score.recall, 1);
  });

  test('an unlabelled fact is reported, not failed', () => {
    const score = scoreExtraction(fixture('climbing-interest'), {
      ...IDEAL['climbing-interest']!,
      facts: [...IDEAL['climbing-interest']!.facts, { kind: 'interest', en: 'They enjoy chess.', fr: null, happensAround: null }],
    }, META);
    assert.deepEqual(score.unlabelled, ['They enjoy chess.']);
    assert.equal(score.fictionLeaks.length + score.sensitiveLeaks.length, 0);
  });

  test('a null extraction is a structured failure, not a throw', () => {
    const score = scoreExtraction(fixture('delf-goal'), null, META);
    assert.equal(score.structuredFailure, true);
    assert.equal(score.recall, 0);
    assert.equal(score.openerOk, false);
  });
});

describe('fixtures', () => {
  test('every fixture has an ideal answer that scores clean', () => {
    assert.ok(EXTRACT_FIXTURES.length >= 10);
    for (const item of EXTRACT_FIXTURES) {
      const ideal = IDEAL[item.id];
      assert.ok(ideal, `${item.id} has no ideal`);
      const score = scoreExtraction(item, ideal, META);
      assert.ok(score.recall === null || score.recall === 1, `${item.id} recall ${score.recall}`);
      assert.deepEqual([score.fictionLeaks, score.sensitiveLeaks, score.knownRepeats, score.unlabelled], [[], [], [], []], item.id);
      assert.equal(score.openerOk, true, item.id);
    }
  });

  test('ids are unique, one session is long, and nothing looks like real personal data', () => {
    assert.equal(new Set(EXTRACT_FIXTURES.map((item) => item.id)).size, EXTRACT_FIXTURES.length);
    assert.ok(EXTRACT_FIXTURES.some((item) => item.history.length >= 20));
    const text = JSON.stringify(EXTRACT_FIXTURES);
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'no emails');
    assert.doesNotMatch(text, /\+?\d[\d\s().-]{7,}\d/, 'no phone numbers');
  });
});

describe('trim', () => {
  test('drops only noted, taught and beat assistant lines', () => {
    const trimmed = trimHistory([
      { role: 'assistant', text: '(narration) The café is busy.' },
      { role: 'assistant', text: '(noted grammar: "je veux" -> "je voudrais")' },
      { role: 'assistant', text: '(taught: l’addition = the bill)' },
      { role: 'assistant', text: '(beat: the order arrives)' },
      { role: 'assistant', text: '(coach) Nice!' },
      { role: 'user', text: '(noted my own note)' },
      { role: 'assistant', text: 'Serveur: Et avec ça ?' },
    ]);
    assert.deepEqual(trimmed.map((message) => message.text), [
      '(narration) The café is busy.', '(coach) Nice!', '(noted my own note)', 'Serveur: Et avec ça ?',
    ]);
  });
});

describe('pass rule', () => {
  const clean = (recall: number): ExtractCallScore => ({
    ...scoreExtraction(fixture('interview-tuesday'), IDEAL['interview-tuesday']!, META), recall,
  });
  const config = { model: 'm', effort: 'high', trim: false, repeats: 1 };

  test('passes at or above baseline recall with zero leaks', () => {
    const baseline = summariseExtraction([clean(0.8)], config);
    assert.equal(passRule(summariseExtraction([clean(0.8)], config), baseline).pass, true);
    assert.equal(passRule(summariseExtraction([clean(0.7)], config), baseline).pass, false);
  });

  test('any leak fails even with better recall', () => {
    const baseline = summariseExtraction([clean(0.5)], config);
    const leaky = { ...clean(1), sensitiveLeaks: ['x'] };
    assert.equal(passRule(summariseExtraction([leaky], config), baseline).pass, false);
  });

  test('without a baseline there is no recall verdict, only the zero checks', () => {
    const result = passRule(summariseExtraction([clean(0.1)], config), null);
    assert.equal(result.pass, true);
    assert.ok(result.lines.some((line) => /no baseline/i.test(line)));
  });
});

test('with no key the eval prints BLOCKED and exits 2', () => {
  let code = 0;
  let out = '';
  try {
    out = execFileSync(process.execPath, ['--experimental-strip-types', EVAL], {
      encoding: 'utf8', cwd: WORKSPACE,
      env: { PATH: process.env.PATH ?? '', LUVANI_ENV_FILE: NO_ENV_FILE },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    code = failure.status ?? -1;
    out = `${failure.stdout ?? ''}${failure.stderr ?? ''}`;
  }
  assert.equal(code, 2, out);
  assert.match(out, /^BLOCKED: OPENAI_API_KEY is not set/m);
  assert.doesNotMatch(out, /recall/i);
});
