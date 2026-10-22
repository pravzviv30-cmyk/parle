/**
 * The scene Today leads with — F543, F571, and the notebook redesign.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). Today used to lead with the
 * café for a first run and with the day's scene after that. It now leads with
 * the next scene on the CEFR spine (`spineFrom(progress).next`), drawn as a
 * scene brief: the level, the French title, what the learner will be able to
 * do, two or three lines they will say, and the minutes. Only a learner who has
 * earned every scene on the spine meets the day's scene instead.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DAILY_SCENARIOS,
  FIRST_MISSION,
  MISSIONS,
  SCENE_SPINE,
  dailyPick,
  getMission,
  missionStates,
  scenariosForLevel,
  spineFrom,
  type MissionCompletion,
  type MissionProgress,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { goalOf } from '../onboarding/goalLine.ts';
import { createStoredProfile, withOnboardingGoal, type StoredProfile } from '../profile/store.ts';
import type { ScenarioRecord } from '../missions/progressStore.ts';
import { estimateMinutes, missionMinutes } from './estimate.ts';
import { HERO_COPY, HERO_LABELS, START, fallbackHero, heroBookmark, heroStart, homeMissionFrom } from './homeMission.ts';

const EVENING = new Date(2026, 8, 12, 21, 0, 0).getTime();

function progressWith(completions: MissionCompletion[] = [], now = EVENING): MissionProgress[] {
  return missionStates(completions, [], now);
}

test('the untouched next scene respects the setup suggestion without awarding a can-do, while real history wins', () => {
  const progress = progressWith();
  const hero = homeMissionFrom({ progress, records: [], levelIndex: 0, now: EVENING, startingMissionId: 'mission:cafe' });
  assert.ok(hero?.kind === 'scene');
  assert.equal(hero.mission.id, 'mission:cafe');
  assert.equal(spineFrom(progress).next?.id, FIRST_MISSION);
  const helped = homeMissionFrom({ progress: progressWith([{ id: FIRST_MISSION, at: EVENING - 5000, rung: 1 }]), records: [], levelIndex: 0, now: EVENING, startingMissionId: 'mission:cafe' });
  assert.ok(helped?.kind === 'scene');
  assert.equal(helped.mission.id, FIRST_MISSION);
  const resume = homeMissionFrom({ progress, records: [{ missionId: 'mission:hotel', at: EVENING - 1000, elapsedMs: 1000, beatsDone: 1 }], levelIndex: 0, now: EVENING, startingMissionId: 'mission:cafe' });
  assert.ok(resume?.kind === 'scene');
  assert.equal(resume.mission.id, 'mission:hotel');
});

/** Every mission on the spine earned on its own, which is rung 4. */
const allEarned = (): MissionCompletion[] => SCENE_SPINE.map((id, i) => ({ id, at: EVENING - 10_000 - i, rung: 4 }));

describe('the scene Today leads with', () => {
  test('a first run leads with the opener, as a brief: level, French title, can-do, lines and about three minutes', () => {
    const hero = homeMissionFrom({ progress: progressWith(), records: [], levelIndex: 0, now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene', 'a first run is not offered a scene off the spine');
    const opener = getMission(FIRST_MISSION)!;
    assert.equal(hero.mission.id, spineFrom(progressWith()).next!.id, "the hero is not the spine's next scene");
    assert.equal(hero.mission.id, opener.id);
    assert.equal(hero.level, 'A0');
    assert.equal(hero.french, opener.title, "the French title is not the scene's own");
    assert.equal(hero.title, opener.titleEn);
    assert.equal(hero.canDo, opener.canDoEn, "the can-do is not the mission's canDoEn");
    assert.deepEqual(hero.lines, opener.referencePhrases.slice(0, 3));
    assert.equal(hero.minutes, 3, 'the opener is not about three minutes');
    assert.equal(hero.minutes, missionMinutes(opener));
    assert.equal(hero.label, null, 'a scene nobody started carries a caps label it has nothing true to say with');

    // And it starts that scene directly, by id. No chooser on the way.
    assert.deepEqual(heroStart(hero), { params: { missionId: opener.id }, missionId: opener.id });
    // A mission is not bookmarked: the shelf holds daily scenes only.
    assert.equal(heroBookmark(hero), null);
  });

  test('the hero follows the spine: an earned scene is skipped, and a rung-one finish earns nothing', () => {
    const helped = homeMissionFrom({ progress: progressWith([{ id: FIRST_MISSION, at: EVENING - 5000, rung: 1 }]), records: [], levelIndex: 0, now: EVENING });
    assert.ok(helped !== null && helped.kind === 'scene');
    assert.equal(helped.mission.id, FIRST_MISSION, 'a finish with the whole line handed over moved the learner past the opener');

    const hero = homeMissionFrom({ progress: progressWith([{ id: FIRST_MISSION, at: EVENING - 5000, rung: 4 }]), records: [], levelIndex: 0, now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:cafe', 'the café is not next after the opener is earned');
    assert.equal(hero.minutes, estimateMinutes({ kind: 'mission', beats: hero.mission.beatIds.length }));

    // Every scene on the spine yields a brief with two or three lines.
    for (const id of SCENE_SPINE) {
      const lines = getMission(id)!.referencePhrases.slice(0, 3);
      assert.ok(lines.length >= 2 && lines.length <= 3, `${id} has ${lines.length} lines to show`);
    }
    assert.equal(SCENE_SPINE.length, MISSIONS.length);
  });

  test('a scene left part way on the spine comes back with its own measured minutes', () => {
    const progress = progressWith([{ id: FIRST_MISSION, at: EVENING - 900_000, rung: 4 }]);
    const record: ScenarioRecord = { missionId: 'mission:cafe', at: EVENING - 60_000, elapsedMs: 120_000, beatsDone: 2 };
    const hero = homeMissionFrom({ progress, records: [record], levelIndex: 0, now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:cafe');
    assert.equal(hero.label, HERO_LABELS.resume);
    assert.ok(hero.minutes > 0);
  });

  test('the newest unfinished scene is offered before an unrelated spine suggestion', () => {
    const progress = progressWith();
    const older: ScenarioRecord = { missionId: 'mission:hotel', at: EVENING - 90_000, elapsedMs: 60_000, beatsDone: 1 };
    const newer: ScenarioRecord = { missionId: 'mission:marche', at: EVENING - 30_000, elapsedMs: 60_000, beatsDone: 1 };
    const hero = homeMissionFrom({ progress, records: [older, newer], levelIndex: 0, now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:marche');
    assert.equal(hero.label, HERO_LABELS.resume);
    const finished = progressWith([{ id: 'mission:marche', at: EVENING - 10_000, rung: 1 }]);
    const afterFinish = homeMissionFrom({ progress: finished, records: [newer], levelIndex: 0, now: EVENING });
    assert.ok(afterFinish !== null && afterFinish.kind === 'scene');
    assert.equal(afterFinish.mission.id, FIRST_MISSION, 'a finished scene must not be offered as a resume');
  });

  test("a learner who has earned the whole spine meets the day's scene", () => {
    const progress = progressWith(allEarned());
    assert.equal(spineFrom(progress).next, null);
    const hero = homeMissionFrom({ progress, records: [], levelIndex: 0, now: EVENING });
    assert.ok(hero !== null && hero.kind === 'today');
    assert.equal(hero.scenario.id, dailyPick(scenariosForLevel(DAILY_SCENARIOS, 0), EVENING).id);
    assert.equal(hero.title, hero.scenario.titleEn);
    assert.equal(hero.minutes, estimateMinutes({ kind: 'scenario', lines: hero.scenario.lines.length }));
    assert.deepEqual(heroBookmark(hero), { id: hero.scenario.id, titleEn: hero.scenario.titleEn });
    assert.ok('seedTopic' in heroStart(hero).params);
  });

  test('nothing to offer from is nothing, and a failed read claims nothing about the learner', () => {
    assert.equal(homeMissionFrom({ progress: [], records: [], levelIndex: 0, now: EVENING }), null);
    const fallback = fallbackHero();
    assert.ok(fallback.kind === 'scene');
    assert.equal(fallback.mission.id, SCENE_SPINE[0]);
    assert.equal(fallback.label, null);

    assert.equal(START, 'Start');
    for (const line of HERO_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /—|\d|%/);
      assert.doesNotMatch(line, /Ready when you are/);
    }
  });
});

// 2026-10-22: the next scene leans towards the learner's onboarding goal (core `nextScene`).
import { nextScene as coreNextScene } from '@luvani/core';
import { sceneEyebrow } from './todayView.ts';

describe('the onboarding goal orders the hero', () => {
  test('a brand-new learner starts on the opener whatever the goal', () => {
    const hero = homeMissionFrom({ progress: progressWith(), records: [], levelIndex: 0, goal: 'moving', now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:premier-cafe');
    assert.equal(hero.picked, 'spine');
  });

  test('after the opener, a learner moving to France meets the neighbour, picked for the move', () => {
    const opened = progressWith([{ id: 'mission:premier-cafe', at: EVENING - 86_400_000, rung: 4 }]);
    const hero = homeMissionFrom({ progress: opened, records: [], levelIndex: 0, goal: 'moving', now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:voisin');
    assert.equal(hero.picked, 'goal');
    assert.equal(sceneEyebrow(hero), 'Picked for your move');
  });

  test('no goal, or "because", is the spine, counted as before', () => {
    for (const goal of [null, 'because'] as const) {
      const hero = homeMissionFrom({ progress: progressWith(), records: [], levelIndex: 0, goal, now: EVENING });
      assert.ok(hero !== null && hero.kind === 'scene');
      assert.equal(hero.mission.id, spineFrom(progressWith()).next!.id);
      assert.equal(hero.picked, 'spine');
      assert.match(sceneEyebrow(hero), /^Next scene, 1 of \d+$/);
    }
  });

  test('a scene left part way still wins over the goal', () => {
    const record: ScenarioRecord = { missionId: 'mission:cafe', at: EVENING - 60_000, elapsedMs: 120_000, beatsDone: 2 };
    const hero = homeMissionFrom({ progress: progressWith(), records: [record], levelIndex: 0, goal: 'moving', now: EVENING });
    assert.ok(hero !== null && hero.kind === 'scene');
    assert.equal(hero.mission.id, 'mission:cafe');
    assert.equal(sceneEyebrow(hero), HERO_LABELS.resume);
  });

  test('a goal changed or cleared in Learning preferences reorders the hero from the stored profile', () => {
    const opened = progressWith([{ id: 'mission:premier-cafe', at: EVENING - 86_400_000, rung: 4 }]);
    const profile: StoredProfile = { ...createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null }, EVENING), onboardingGoal: 'moving' };
    const heroFor = (p: StoredProfile) => homeMissionFrom({ progress: opened, records: [], levelIndex: 0, goal: goalOf(p), now: EVENING });

    const moving = heroFor(profile);
    assert.ok(moving !== null && moving.kind === 'scene');
    assert.equal(moving.mission.id, 'mission:voisin');
    assert.equal(sceneEyebrow(moving), 'Picked for your move');

    const food = heroFor(withOnboardingGoal(profile, 'food'));
    assert.ok(food !== null && food.kind === 'scene');
    assert.equal(food.mission.id, coreNextScene(opened, 'food')!.mission.id);
    assert.equal(sceneEyebrow(food), 'Picked for ordering food and drinks');

    const cleared = heroFor(withOnboardingGoal(profile, null));
    assert.ok(cleared !== null && cleared.kind === 'scene');
    assert.equal(cleared.mission.id, spineFrom(opened).next!.id);
    assert.equal(cleared.picked, 'spine');
    assert.match(sceneEyebrow(cleared), /^Next scene/);
  });

  test('the hero is the scene core picks for the goal', () => {
    for (const goal of ['food', 'trip', 'family', 'moving', 'work'] as const) {
      const hero = homeMissionFrom({ progress: progressWith(), records: [], levelIndex: 0, goal, now: EVENING });
      assert.ok(hero !== null && hero.kind === 'scene');
      assert.equal(hero.mission.id, coreNextScene(progressWith(), goal)!.mission.id);
    }
  });
});
