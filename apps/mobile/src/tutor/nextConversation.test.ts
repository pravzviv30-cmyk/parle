import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_MISSION, MISSIONS, SCENE_SPINE, getMission, missionStates, tutorVoice } from '@luvani/core';
import { missionMinutes, sceneMeta } from '../home/estimate.ts';
import { nextConversation } from './nextConversation.ts';

test('a new learner receives a real mission and no invented continuity', () => {
  const next = nextConversation(missionStates([], [], 0), null, false);
  assert.equal(next.params.missionId, FIRST_MISSION);
  assert.equal(next.label, 'Your next conversation');
  // Rewritten 2026-09-27 (notebook Phase 3): the derived minutes, so the
  // opener reads about three rather than the open-mission eight.
  // Revamp B (F603): the minutes are handed over as a number for the brief's
  // meta line to say, rather than joined into a detail line here.
  assert.equal(next.minutes, 3, 'the opener is offered as something other than about three minutes');
});

test('the next conversation is the next scene on the spine', () => {
  const next = nextConversation(missionStates([{ id: FIRST_MISSION, at: 1, rung: 4 }], [], 2), null, false);
  assert.equal(next.params.missionId, SCENE_SPINE[1], 'Speak offers something other than the spine\'s next scene');
  assert.equal(next.minutes, missionMinutes(getMission(SCENE_SPINE[1]!)!), 'the minutes are not the next scene\'s own');
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

// Revamp B (F603). Speak draws the next conversation as the blue scene brief,
// so the model hands over the pieces that card is built from: the French title,
// the minutes and the can-do. The old detail line joined the level and the
// minutes with a middot; the brief's meta line joins with commas, so the model
// joins nothing at all.
test('the next conversation carries its French title and minutes, and joins nothing with a middot', () => {
  const tutor = tutorVoice('alexandre').persona.name;

  // A scene: its own French name, its derived minutes and its can-do line.
  const scene = nextConversation(missionStates([], [], 0), null, false);
  const opener = getMission(FIRST_MISSION)!;
  assert.equal(scene.french, opener.title, 'the brief is not headed by the scene\'s French name');
  assert.equal(scene.minutes, missionMinutes(opener));
  assert.equal(scene.canDo, opener.canDoEn);
  assert.equal(scene.title, opener.titleEn, 'the English name under the French one moved');
  assert.equal(sceneMeta(scene.label, scene.minutes, tutor), `Your next conversation, about 3 minutes with ${tutor}`);

  // A picked-up scene carries the same three pieces, from that scene.
  const mission = MISSIONS[1]!;
  const resumed = nextConversation(missionStates([], [], 0), { kind: 'scene', missionId: mission.id, line: 'Continue this scene.' }, false);
  assert.equal(resumed.french, mission.title);
  assert.equal(resumed.minutes, missionMinutes(mission));
  assert.equal(resumed.canDo, mission.canDoEn);

  // An open conversation has no scene behind it, so it invents none of the
  // three. Its line is the thread's own.
  const thread = { kind: 'pack' as const, packId: 'pack-one', seedTopic: { fr: 'Au marché', en: 'At the market' }, line: 'Continue our conversation.' };
  const open = nextConversation([], thread, true);
  assert.equal(open.french, null, 'an open conversation claims a scene title');
  assert.equal(open.minutes, null, 'an open conversation claims a length nobody measured');
  assert.equal(open.canDo, null, 'an open conversation claims a can-do');
  assert.equal(open.body, thread.line, 'the thread\'s own line is gone');
  assert.equal(sceneMeta(open.label, open.minutes, tutor), `Continue your conversation, with ${tutor}`);

  // No joined-up detail line survives, and no string the model hands over
  // carries a middot or a dash.
  for (const next of [scene, resumed, open]) {
    assert.equal('detail' in next, false, 'the joined-up detail line is back');
    const words = Object.values(next).flatMap((value) =>
      typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : [],
    );
    assert.ok(words.length >= 3, 'the walk read nothing');
    for (const line of words) {
      assert.doesNotMatch(line, /[·—–]/, `"${line}" joins with a middot or a dash`);
    }
  }
});

// 2026-10-22: Speak's Start leans towards the onboarding goal, and says so.
test('the goal chooses the next conversation and the card says why', () => {
  const fresh = nextConversation(missionStates([], [], 0), null, false, 'trip');
  assert.equal(fresh.params.missionId, FIRST_MISSION, 'a brand-new learner starts on the opener');
  assert.equal(fresh.picked, null);
  const opened = missionStates([{ id: 'mission:premier-cafe', at: 1, rung: 4 }], [], 2);
  const next = nextConversation(opened, null, false, 'trip');
  assert.equal(next.params.missionId, 'mission:gare');
  assert.equal(next.picked, 'Picked for your trip');
  const plain = nextConversation(missionStates([], [], 0), null, false, 'because');
  assert.equal(plain.params.missionId, FIRST_MISSION);
  assert.equal(plain.picked, null);
});

test('a scene to pick up is never labelled as picked for the goal', () => {
  const next = nextConversation(missionStates([], [], 0), { kind: 'scene', missionId: 'mission:hotel', line: 'Continue this scene.' }, false, 'trip');
  assert.equal(next.params.missionId, 'mission:hotel');
  assert.equal(next.picked, null);
});
