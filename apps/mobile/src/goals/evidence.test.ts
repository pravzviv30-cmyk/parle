/**
 * What came of a goal, joined by id and never by time (Stage 4, 2026-09-25).
 *
 * Contract test 12, and test 4's reader half: a step joins its pack by id, the
 * pack's own practice outcomes through `packTargetsOf`, and the learner's own
 * used-outside report. Nothing for a deleted pack, a goal the learner no longer
 * has, or a report whose step aged out. No timestamp attribution anywhere.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildConversationPack, type ConversationPack } from '@luvani/core';

import { factKey } from '../profile/memory.ts';
import type { PracticeEvent } from '../practice/history.ts';
import { mergeGoalSteps, type GoalStepEvent } from './model.ts';
import { goalEvidence } from './evidence.ts';

const GOAL = 'Order a coffee in Paris';
const KEY = factKey(GOAL);
const GOALS = [GOAL, 'Check into a hotel'];

function pack(id: string, createdAt = '2026-09-20T10:00:00.000Z'): ConversationPack {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'learner-1',
    createdAt,
    title: { fr: 'Au café', en: 'At the café' },
    summary: 'Ordered a coffee.',
    keyPhrases: [{ fr: 'Un café, s’il vous plaît', frWritten: null, en: 'A coffee, please' }],
  });
}

const step = (id: string, at: number, goalKey = KEY): GoalStepEvent => ({ kind: 'step-started', id, at, goalKey, task: 'mission:cafe' });
const used = (id: string, at: number, goalKey = KEY): GoalStepEvent => ({ kind: 'used-outside', id: `u.${id}`, at, goalKey });

const sitting = (id: string, packId: string, at: number, outcome: 'recalled' | 'practised' | 'unresolved'): PracticeEvent => ({
  kind: 'session-completed',
  id,
  at,
  packId,
  targets: [
    { phraseKey: 'phrase:un café', source: { kind: 'pack', packId }, outcome, attempts: outcome === 'recalled' ? 1 : 2 },
  ],
});

describe('what came of a goal — contract test 12', () => {
  test('a step whose pack is gone from the cache shows nothing', () => {
    const trail = goalEvidence(KEY, [step('pack-a', 10)], [], [], GOALS);
    assert.deepEqual(trail, [], 'a deleted conversation was brought back by its goal step');
  });

  test('a step for a goal the learner no longer has shows nothing', () => {
    const removed = factKey('Learn to ski');
    assert.deepEqual(goalEvidence(removed, [step('pack-a', 10, removed)], [pack('pack-a')], [], GOALS), []);
    // And a current goal never shows another goal's steps.
    assert.deepEqual(goalEvidence(KEY, [step('pack-a', 10, factKey('Check into a hotel'))], [pack('pack-a')], [], GOALS), []);
  });

  test('a step with its pack and a sitting on that pack carries the pack\'s own outcomes and the self-report only when it exists', () => {
    const packs = [pack('pack-a')];
    const history = [sitting('s1', 'pack-a', 20, 'practised')];
    const plain = goalEvidence(KEY, [step('pack-a', 10)], packs, history, GOALS);
    assert.equal(plain.length, 1);
    assert.equal(plain[0]!.pack.id, 'pack-a');
    assert.equal(plain[0]!.at, 10, 'the rehearsal date is not the step\'s own time');
    assert.equal(plain[0]!.practice, 'practised');
    assert.equal(plain[0]!.usedOutside, false, 'a report nobody made was shown');

    const reported = goalEvidence(KEY, [step('pack-a', 10), used('pack-a', 30)], packs, history, GOALS);
    assert.equal(reported[0]!.usedOutside, true);
    assert.equal(reported[0]!.stepId, 'pack-a');
  });

  test('the newest sitting on the pack decides the line, recall first, and review targets never count', () => {
    const packs = [pack('pack-a')];
    const recalled = goalEvidence(KEY, [step('pack-a', 10)], packs, [sitting('s1', 'pack-a', 20, 'practised'), sitting('s2', 'pack-a', 30, 'recalled')], GOALS);
    assert.equal(recalled[0]!.practice, 'recalled');
    const unresolved = goalEvidence(KEY, [step('pack-a', 10)], packs, [sitting('s1', 'pack-a', 20, 'unresolved')], GOALS);
    assert.equal(unresolved[0]!.practice, 'attempted');
    // A sitting on another pack, and review targets in a sitting, never count here.
    const elsewhere: PracticeEvent = {
      kind: 'session-completed',
      id: 's3',
      at: 40,
      packId: null,
      targets: [{ phraseKey: 'phrase:merci', source: { kind: 'review' }, outcome: 'recalled', attempts: 1 }],
    };
    const none = goalEvidence(KEY, [step('pack-a', 10)], packs, [sitting('s4', 'pack-b', 20, 'recalled'), elsewhere], GOALS);
    assert.equal(none[0]!.practice, null, 'practice on something else was credited to this goal');
  });

  test('nothing is attributed by time: a conversation not opened from the goal is never on its trail', () => {
    // pack-b was created right after the goal step, but no step names it.
    const trail = goalEvidence(KEY, [step('pack-a', 10)], [pack('pack-a'), pack('pack-b', '2026-09-20T10:01:00.000Z')], [], GOALS);
    assert.deepEqual(trail.map((row) => row.pack.id), ['pack-a']);
    const source = readFileSync(fileURLToPath(new URL('./evidence.ts', import.meta.url)), 'utf8');
    assert.ok(!/createdAt/.test(source), 'evidence.ts reads a pack\'s creation time, which is how attribution by time starts');
  });

  test('newest step first, one row per step', () => {
    const trail = goalEvidence(KEY, [step('pack-a', 10), step('pack-b', 50)], [pack('pack-a'), pack('pack-b')], [], GOALS);
    assert.deepEqual(trail.map((row) => row.stepId), ['pack-b', 'pack-a']);
  });
});

describe('a report whose step aged out — contract test 4', () => {
  test('survives the merge and draws nothing', () => {
    const steps: GoalStepEvent[] = [step('pack-old', 1)];
    for (let i = 0; i < 60; i += 1) steps.push(step(`pack-${String(i).padStart(3, '0')}`, 100 + i));
    steps.push(used('pack-old', 1000));
    const merged = mergeGoalSteps({ version: 1, steps }, null).steps;
    assert.ok(!merged.some((row) => row.id === 'pack-old'), 'the old step was not capped out, so this proves nothing');
    assert.ok(merged.some((row) => row.id === 'u.pack-old'), 'the newer report was dropped with its step');
    const trail = goalEvidence(KEY, merged, [pack('pack-old')], [], GOALS);
    assert.ok(!trail.some((row) => row.stepId === 'pack-old'), 'an orphan report drew a row of its own');
  });
});
