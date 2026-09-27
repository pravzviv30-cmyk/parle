import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_MISSION, MISSIONS, SCENE_SPINE, missionStates } from '@luvani/core';
import { nextConversation } from './nextConversation.ts';

test('a new learner receives a real mission and no invented continuity', () => {
  const next = nextConversation(missionStates([], [], 0), null, false);
  assert.equal(next.params.missionId, FIRST_MISSION);
  assert.equal(next.label, 'Your next conversation');
  // Rewritten 2026-09-27 (notebook Phase 3): the level and the derived minutes,
  // so the opener reads about three rather than the open-mission eight.
  assert.equal(next.detail, 'A0 · About 3 min');
});

test('the next conversation is the next scene on the spine', () => {
  const next = nextConversation(missionStates([{ id: FIRST_MISSION, at: 1, rung: 4 }], [], 2), null, false);
  assert.equal(next.params.missionId, SCENE_SPINE[1], 'Speak offers something other than the spine\'s next scene');
  assert.match(next.detail, /^A0 · About \d+ min$/);
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
