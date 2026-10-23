import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS, FIRST_MISSION, getMission, isEarned, missionStates, type MissionCompletion, type MissionId } from './missions.ts';
import type { LearnerGoal } from '../firstPractice.ts';
import { GOAL_SCENES, SCENE_SPINE, nextScene, spineFrom } from './spine.ts';
import type { Rung } from '../ladder/ladder.ts';

const NOW = new Date(2026, 8, 27, 12).getTime();
const DAY = 86_400_000;

const done = (id: MissionId, rung: Rung, at = NOW - DAY): MissionCompletion => ({ id, at, rung });

const A0_IDS = MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id);
const A1_IDS = MISSIONS.filter((m) => m.cefr === 'A1').map((m) => m.id);
const A2_IDS = MISSIONS.filter((m) => m.cefr === 'A2').map((m) => m.id);

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
        'mission:restaurant',
        'mission:pharmacie',
        'mission:gare',
        'mission:colis',
        'mission:voisin',
        'mission:week-end',
        'mission:collegues',
        'mission:telephone',
        'mission:medecin',
        'mission:retour',
        'mission:appartement',
        'mission:belle-famille',
        'mission:club',
        'mission:banque',
        'mission:sortie',
        'mission:montreal',
        'mission:coup-de-main',
        'mission:anniversaire',
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

  test('the level is A2 only once every A0 and every A1 scene is earned', () => {
    assert.ok(A1_IDS.length >= 2, 'the fixture needs at least two A1 scenes to prove anything');
    const allA0 = A0_IDS.map((id) => done(id, 4));

    const a1AllButOne = A1_IDS.slice(0, -1).map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates([...allA0, ...a1AllButOne], [], NOW)).level, 'A1', 'one A1 scene is still unearned');

    const a1OneHelped = [...a1AllButOne, done(A1_IDS[A1_IDS.length - 1]!, 3)];
    assert.equal(
      spineFrom(missionStates([...allA0, ...a1OneHelped], [], NOW)).level,
      'A1',
      'a helped A1 finish is not an earned one, so the level stays at A1',
    );

    const allA1 = A1_IDS.map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates([...allA0, ...allA1], [], NOW)).level, 'A2');
  });

  test('every A1 scene earned with an A0 scene still open is A0, not A2', () => {
    const allA1 = A1_IDS.map((id) => done(id, 4));
    const a0AllButOne = A0_IDS.slice(0, -1).map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates([...a0AllButOne, ...allA1], [], NOW)).level, 'A0', 'A2 needs every A0 scene too');
  });

  test('the A2 scenes come last on the spine, and earning them never moves the level early', () => {
    // 2026-10-22: seven became thirteen with the six A2 scenes in
    // docs/changes/mission-spine-b1.md (class, bank, cinema plans, Montréal
    // coat, colleague help, partner's sister's birthday).
    assert.equal(A2_IDS.length, 13, 'the thirteen A2 scenes from docs/changes/mission-spine-a2.md and mission-spine-b1.md');
    assert.deepEqual([...SCENE_SPINE].slice(-A2_IDS.length), A2_IDS, 'A2 follows every A0 and A1 scene');

    const allA0 = A0_IDS.map((id) => done(id, 4));
    const allA2 = A2_IDS.map((id) => done(id, 4));
    const a1AllButOne = A1_IDS.slice(0, -1).map((id) => done(id, 4));
    assert.equal(
      spineFrom(missionStates([...allA0, ...a1AllButOne, ...allA2], [], NOW)).level,
      'A1',
      'every A2 scene earned with an A1 scene still open is still A1',
    );

    const view = spineFrom(missionStates([...allA0, ...A1_IDS.map((id) => done(id, 4))], [], NOW));
    assert.equal(view.level, 'A2');
    assert.equal(view.next?.id, A2_IDS[0], 'with A0 and A1 earned, the next scene is the first A2 one');
  });

  test('the level is B1 only once every A0, A1 and A2 scene is earned', () => {
    const allA0 = A0_IDS.map((id) => done(id, 4));
    const allA1 = A1_IDS.map((id) => done(id, 4));
    const allA2 = A2_IDS.map((id) => done(id, 4));
    assert.equal(spineFrom(missionStates([...allA0, ...allA1, ...allA2.slice(1)], [], NOW)).level, 'A2', 'one A2 scene is still unearned');
    const a2OneHelped = [...allA2.slice(1), done(A2_IDS[0]!, 2)];
    assert.equal(spineFrom(missionStates([...allA0, ...allA1, ...a2OneHelped], [], NOW)).level, 'A2', 'a helped A2 finish is not an earned one');
    assert.equal(spineFrom(missionStates([...allA0, ...allA1.slice(1), ...allA2], [], NOW)).level, 'A1', 'B1 needs every A1 scene too');
    assert.equal(spineFrom(missionStates([...allA0, ...allA1, ...allA2], [], NOW)).level, 'B1');
  });

  test('with every scene earned there is nothing next', () => {
    const view = spineFrom(missionStates(SCENE_SPINE.map((id) => done(id, 4)), [], NOW));
    assert.equal(view.next, null);
    // 2026-10-22: was 'A2' while the spine stopped at A2. Every A0, A1 and A2
    // scene earned is now B1, even before any B1 mission exists.
    assert.equal(view.level, 'B1');
    assert.deepEqual(view.earned.map((m) => m.id), [...SCENE_SPINE]);
  });
});

describe('nextScene — the goal orders the suggestion, never the level', () => {
  const earnedAll = (ids: readonly MissionId[]) => missionStates(ids.map((id) => done(id, 4)), [], NOW);
  const empty = missionStates([], [], NOW);

  test('every goal scene is a real mission and every goal has scenes', () => {
    const ids = new Set(MISSIONS.map((m) => m.id));
    for (const [goal, scenes] of Object.entries(GOAL_SCENES)) {
      assert.ok(scenes.length > 0, `${goal} has no scenes`);
      for (const id of scenes) assert.ok(ids.has(id), `${goal}: ${id} is not a mission`);
    }
  });

  test('a brand-new learner starts on the opener whatever the goal', () => {
    for (const goal of Object.keys(GOAL_SCENES)) {
      const next = nextScene(empty, goal as LearnerGoal);
      assert.equal(next?.mission.id, spineFrom(empty).next?.id, goal);
      assert.equal(next?.mission.id, FIRST_MISSION, goal);
      assert.equal(next?.picked, 'spine', goal);
    }
  });

  test('after the opener, an A0 learner gets the first goal scene within one band', () => {
    const opened = earnedAll(['mission:premier-cafe']);
    const expected = { moving: 'mission:voisin', trip: 'mission:gare', food: 'mission:cafe', family: 'mission:amis', work: 'mission:journee' } as const;
    for (const [goal, id] of Object.entries(expected)) {
      const next = nextScene(opened, goal as LearnerGoal);
      assert.equal(next?.mission.id, id, goal);
      assert.equal(next?.picked, 'goal', goal);
    }
  });

  test('at A1 the reach is A2, so moving opens on the flat', () => {
    const progress = earnedAll([...A0_IDS, ...A1_IDS]);
    assert.equal(spineFrom(progress).level, 'A2');
    const a1 = earnedAll([...A0_IDS, 'mission:marche']);
    assert.equal(spineFrom(a1).level, 'A1');
    assert.deepEqual(nextScene(a1, 'moving'), { mission: getMission('mission:appartement'), picked: 'goal' });
  });

  test('earned goal scenes are skipped', () => {
    const next = nextScene(earnedAll(['mission:gare', 'mission:restaurant']), 'trip');
    assert.equal(next?.mission.id, 'mission:chemin');
    assert.equal(next?.picked, 'goal');
  });

  test('with every goal scene in reach earned it falls back to the spine', () => {
    const progress = earnedAll(['mission:cafe', 'mission:restaurant', 'mission:marche']);
    const next = nextScene(progress, 'food');
    assert.equal(next?.picked, 'spine');
    assert.equal(next?.mission.id, spineFrom(progress).next?.id);
  });

  test("'because', no goal or an unknown goal walk the spine", () => {
    for (const goal of ['because', null, undefined, 'skydiving'] as const) {
      const next = nextScene(empty, goal as LearnerGoal | null | undefined);
      assert.equal(next?.mission.id, FIRST_MISSION);
      assert.equal(next?.picked, 'spine');
    }
  });

  test('nextScene never moves the level', () => {
    const progress = earnedAll(A0_IDS);
    const before = spineFrom(progress).level;
    nextScene(progress, 'moving');
    assert.equal(spineFrom(progress).level, before);
  });
});
