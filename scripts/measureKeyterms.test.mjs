import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAFE_LESSON } from '../packages/core/src/lessons/cafe.ts';
import { CREDIT_CAP, buildPlan, estimateTotal, exactMatch, keytermQuery, summarise } from './measureKeyterms.mjs';

test('keyterms plan covers every café target once and stays under the credit cap', () => {
  const plan = buildPlan();
  assert.equal(plan.length, CAFE_LESSON.turns.length);
  assert.deepEqual(plan.map(p => p.text), CAFE_LESSON.turns.map(t => t.target));
  assert.ok(estimateTotal(plan) <= CREDIT_CAP);
  assert.equal(new Set(plan.map(p => p.file)).size, plan.length);
});

test('exact match ignores accents, case and punctuation; keyterms are repeated encoded params', () => {
  assert.equal(exactMatch("Un café, s'il vous plaît", 'un cafe s’il vous plait.'), true);
  assert.equal(exactMatch('Un café', 'un thé'), false);
  assert.equal(keytermQuery(['café', "s'il vous plaît"]), "&keyterm=caf%C3%A9&keyterm=s'il%20vous%20pla%C3%AEt");
});

test('summary compares keyterms with plain per group and level', () => {
  const row = (condition, wordAccuracy, exact) => ({ group: 'g', level: 'normal', condition, wordAccuracy, exact });
  const [s] = summarise([row('plain', 0.5, false), row('plain', 1, true), row('keyterms', 1, true), row('keyterms', 1, true)]);
  assert.equal(s.plain.exactMatches, 1);
  assert.equal(s.keyterms.exactMatches, 2);
  assert.equal(s.medianAccuracyGain, 0.25);
  assert.equal(s.exactGain, 1);
});
