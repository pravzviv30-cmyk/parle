import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missionStates } from '@luvani/core';
import { emptyJourney } from './journeyView.ts';
import { nextConversation } from '../tutor/nextConversation.ts';
import { nextCanDo, nextTimeLine } from '../live/keepsake.ts';
import { homeMissionFrom } from '../home/homeMission.ts';
import { startAtOf } from '../profile/practicePreferences.ts';

test('Journey, Today, Speak and the end card all start a placed learner at their placement', () => {
  const now = Date.now();
  const startAt = startAtOf({ practicePreferences: { level: 'getby', confidence: null, focus: null, placement: 'basics' } });
  assert.equal(startAt, 'A1');
  const afterFirst = missionStates([{ id: 'mission:marche', at: now - 1000, rung: 4 }], [], now);
  assert.equal(emptyJourney(missionStates([], [], now), null, startAt).missionId, 'mission:marche');
  assert.equal(nextConversation(afterFirst, null, false, null, startAt).params.missionId, 'mission:chemin');
  assert.match(nextTimeLine(afterFirst, null, startAt) ?? '', /./);
  assert.ok(nextCanDo(afterFirst, null, startAt));
  const hero = homeMissionFrom({ progress: afterFirst, records: [], levelIndex: 0, startAt, now });
  assert.ok(hero?.kind === 'scene'); assert.equal(hero.mission.id, 'mission:chemin');
  assert.equal(startAtOf({}), null);
});
