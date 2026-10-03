import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS, FIRST_MISSION, isEarned, missionStates, type MissionCompletion, type MissionId } from './missions.ts';
import { SCENE_SPINE, spineFrom } from './spine.ts';
import type { Rung } from '../ladder/ladder.ts';

const NOW = new Date(2026, 8, 27, 12).getTime();
const DAY = 86_400_000;

const done = (id: MissionId, rung: Rung, at = NOW - DAY): MissionCompletion => ({ id, at, rung });

const A0_IDS = MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id);

describe('the spine — the order scenes are offered in, and what has been earned', () => {
  test('the spine names every mission once, opening on the first scene', () => {
    assert.deepEqual(
      [...SCENE_SPINE],
      [
        'mission:premier-cafe',
        'mission:cafe',
        'mission:hotel',
        'mission:marche',
        'mission:chemin',
        'mission:journee',
        'mission:amis',
      ],
    );
    assert.equal(SCENE_SPINE[0], FIRST_MISSION);
    assert.deepEqual([...SCENE_SPINE].sort(), MISSIONS.map((m) => m.id).sort(), 'a mission is missing from the spine');
  });

  test('earned means handled on your own, the rule the passport uses', () => {
    for (const rung of [1, 2, 3] as const) {
      const progress = missionStates([done('mission:cafe', rung)], [], NOW).find((p) => p.mission.id === 'mission:cafe')!;
      assert.equal(isEarned(progress), false, `a finish at rung ${rung} had help in play, so nothing is earned yet`);
    }
    const alone = missionStates([done('mission:cafe', 4)], [], NOW).find((p) => p.mission.id === 'mission:cafe')!;
    assert.equal(isEarned(alone), true);
  });

  test('a learner with nothing done is A0 and is pointed at the first scene', () => {
    const view = spineFrom(missionStates([], [], NOW));
    assert.equal(view.level, 'A0');
    assert.equal(view.next?.id, FIRST_MISSION);
    assert.deepEqual(view.earned, []);
  });

  test('a rung-1 completion earns nothing and moves nothing on', () => {
    const view = spineFrom(missionStates([done('mission:premier-cafe', 1)], [], NOW));
    assert.deepEqual(view.earned, [], 'finishing with the whole line handed over is practice, not a can-do');
    assert.equal(view.next?.id, 'mission:premier-cafe', 'the scene is still the one to offer');
    assert.equal(view.level, 'A0');
  });

  test('next skips anything earned, and earned reads in spine order', () => {
    // Completed out of spine order on purpose: the view must follow the spine,
    // not the order the learner happened to finish in.
    const completions = [done('mission:hotel', 4, NOW - DAY), done('mission:premier-cafe', 4, NOW - 2 * DAY)];
    const view = spineFrom(missionStates(completions, [], NOW));

    assert.equal(view.next?.id, 'mission:cafe', 'the first unearned scene on the spine comes next');
    assert.deepEqual(
      view.earned.map((m) => m.id),
      ['mission:premier-cafe', 'mission:hotel'],
    );
  });

  test('the level stays A0 until every A0 scene is earned', () => {
    assert.ok(A0_IDS.length >= 2, 'the fixture needs at least two A0 scenes to prove anything');

    const allButOne = A0_IDS.slice(0, -1).map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates(allButOne, [], NOW)).level, 'A0', 'one A0 scene is still unearned');

    const oneHelped = [...allButOne, done(A0_IDS[A0_IDS.length - 1]!, 3)];
    assert.equal(spineFrom(missionStates(oneHelped, [], NOW)).level, 'A0', 'a helped finish is not an earned one');

    const all = A0_IDS.map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates(all, [], NOW)).level, 'A1');
  });

  test('earning the full café earns the opener, so an existing learner is never sent back to it', () => {
    const view = spineFrom(missionStates([done('mission:cafe', 4)], [], NOW));
    assert.notEqual(view.next?.id, 'mission:premier-cafe', 'the café is earned and the opener was offered next');
    assert.equal(view.next?.id, 'mission:hotel');
    assert.deepEqual(view.earned.map((m) => m.id), ['mission:premier-cafe', 'mission:cafe']);
  });

  test('café and hotel earned without ever opening the opener is A1', () => {
    const view = spineFrom(missionStates([done('mission:cafe', 4), done('mission:hotel', 4)], [], NOW));
    assert.equal(view.level, 'A1', 'a learner who handled the café and the hotel alone was held at A0 by three lines');
  });

  test('a helped café earns nothing on the opener’s behalf', () => {
    const view = spineFrom(missionStates([done('mission:cafe', 3)], [], NOW));
    assert.equal(view.next?.id, 'mission:premier-cafe');
    assert.deepEqual(view.earned, []);
  });

  test('with every scene earned there is nothing next', () => {
    const view = spineFrom(missionStates(SCENE_SPINE.map((id) => done(id, 4)), [], NOW));
    assert.equal(view.next, null);
    assert.equal(view.level, 'A1');
    assert.deepEqual(view.earned.map((m) => m.id), [...SCENE_SPINE]);
  });
});
