import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_MISSION, MISSIONS, missionStates } from '@luvani/core';
import { nextConversation } from './nextConversation.ts';

test('a new learner receives a real mission and no invented continuity', () => {
  const next = nextConversation(missionStates([], [], 0), null, false);
  assert.equal(next.params.missionId, FIRST_MISSION);
  assert.equal(next.label, 'Your next conversation');
  assert.match(next.detail, /^About \d+ min · Guided$/);
});

test('an unfinished scene takes precedence without requiring Max', () => {
  const mission = MISSIONS[1]!;
  const next = nextConversation(missionStates([], [], 0), { kind: 'scene', missionId: mission.id, line: 'Continue this scene.' }, false);
  assert.equal(next.params.missionId, mission.id);
  assert.equal(next.title, mission.titleEn);
  assert.equal(next.label, 'Pick up where you left off');
});

test('continuation preserves the seed and pack identity only when the plan allows it', () => {
  const thread = { kind: 'pack' as const, packId: 'pack-one', seedTopic: { fr: 'Au marché', en: 'At the market' }, line: 'Continue our conversation.' };
  const allowed = nextConversation([], thread, true);
  assert.deepEqual(allowed.params, { seedTopic: thread.seedTopic, continuationPackId: 'pack-one' });
  const gated = nextConversation([], thread, false);
  assert.equal(gated.params.continuationPackId, undefined);
  assert.equal(gated.params.missionId, FIRST_MISSION);
});
