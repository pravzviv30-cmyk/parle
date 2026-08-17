import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DRILL_FIXTURES } from './fixtures.ts';
import { validateBatch, validateExercise } from './validate.ts';
import { stageOf, DRILL_STAGES } from './session.ts';
import type { DrillExercise } from './types.ts';

function ofKind(kind: DrillExercise['kind']): DrillExercise[] {
  return DRILL_FIXTURES.filter((e) => e.kind === kind);
}

describe('every fixture passes the same gate machine-built exercises will face', () => {
  for (const exercise of DRILL_FIXTURES) {
    test(exercise.id, () => {
      const result = validateExercise(exercise);
      assert.deepEqual(result, { ok: true }, result.ok ? undefined : result.reasons.join(' | '));
    });
  }

  test('the batch as a whole is clean, twins and ids included', () => {
    const result = validateBatch(DRILL_FIXTURES);
    assert.deepEqual(result, { ok: true }, result.ok ? undefined : result.reasons.join(' | '));
  });
});

describe('coverage — the bank is big enough to drill the café arc', () => {
  test('minimum counts per kind', () => {
    assert.ok(ofKind('fill-blank').length >= 8, 'fill-blank');
    assert.ok(ofKind('best-sentence').length >= 4, 'best-sentence');
    assert.ok(ofKind('appropriate-reply').length >= 5, 'appropriate-reply');
    assert.ok(ofKind('repeat-this').length >= 5, 'repeat-this');
    assert.ok(ofKind('tap-translate').length >= 4, 'tap-translate');
    assert.ok(ofKind('listen-type').length >= 4, 'listen-type');
    assert.ok(DRILL_FIXTURES.length >= 30, 'the bank as a whole');
  });

  test('fill-blank mixes tapped options and typed answers', () => {
    const fills = ofKind('fill-blank');
    assert.ok(fills.some((e) => e.kind === 'fill-blank' && e.options !== null), 'some offer options');
    assert.ok(fills.some((e) => e.kind === 'fill-blank' && e.options === null), 'some demand typing');
  });

  test('every repeat-this carries a silent twin for the same phrase', () => {
    for (const e of ofKind('repeat-this')) {
      if (e.kind !== 'repeat-this') continue;
      assert.notEqual(e.noMicTwin.kind, 'repeat-this', e.id);
      assert.equal(e.noMicTwin.phraseKey, e.phraseKey, e.id);
    }
  });

  test('one phrase is authored at every rung of the ramp — the reference ladder', () => {
    // "Un café, s'il vous plaît" is the arc's centre of gravity, so it is the
    // phrase a learner should be able to climb without the bank falling back.
    const ladder = DRILL_FIXTURES.filter((e) => e.phraseKey === "phrase:un café, s'il vous plaît");
    const stages = new Set(ladder.map(stageOf));
    assert.deepEqual([...DRILL_STAGES].filter((s) => stages.has(s)), [...DRILL_STAGES]);
  });

  test('generous accepted sets — free-text sentences take real variants, not one blessed string', () => {
    // The gender-and-elision family on the apéro line is the canary: if it
    // shrinks, the bank has started demanding textbook French for spoken French.
    const creve = DRILL_FIXTURES.find((e) => e.id === 'lt-creve');
    assert.ok(creve && 'accepted' in creve && creve.accepted.length >= 4);
  });
});
