/**
 * The plan a new learner sees before an account exists, held to what the spine
 * contract (section 3) lets it claim: the first three scene titles and their
 * can-dos, the tutor's goal text, the minutes, and the reminder time labelled
 * as not on yet. Never a level name, a date, or a promise of a level.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MISSIONS, PLANS, SCENE_SPINE, getMission } from '@luvani/core';
import { DEFAULT_REMINDER_TIME, reminderTime } from '../reminders/reminder.ts';
import { guiltIn } from '../copy/guilt.ts';
import { MAX_GOAL_CHARS } from '../profile/memory.ts';
import { sceneIllustration } from '../art/flat/scenes.ts';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from './preAccountDraft.ts';
import {
  DEFAULT_START_LEVEL,
  METHOD_STEPS,
  NO_STREAKS,
  PLAN_COPY,
  REASONS,
  REMINDER_NOT_ON,
  SEEDED_GOAL,
  START_LEVELS,
  TRIAL_LINE,
  firstSceneFor,
  planFor,
  presetMinutes,
  sceneOrder,
  startEstimate,
} from './plan.ts';

const draft = (extra: Partial<PreAccountOnboardingDraft>): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });

describe('answers to a plan', () => {
  test('scene order is the spine, and a learner who can get by skips the first coffee', () => {
    assert.deepEqual(sceneOrder('zero'), SCENE_SPINE);
    assert.deepEqual(sceneOrder('few'), SCENE_SPINE);
    assert.deepEqual(sceneOrder('getby'), SCENE_SPINE.filter((id) => id !== 'mission:premier-cafe'));
    assert.equal(firstSceneFor('zero'), 'mission:premier-cafe');
    assert.equal(firstSceneFor('few'), 'mission:premier-cafe');
    assert.equal(firstSceneFor('getby'), 'mission:cafe');
    assert.equal(firstSceneFor(null), 'mission:premier-cafe', 'an unanswered level starts at the start');
  });

  test('preset minutes follow the level, and work or a move asks for fifteen', () => {
    assert.equal(presetMinutes('zero', null), 5);
    assert.equal(presetMinutes('few', null), 10);
    assert.equal(presetMinutes('getby', null), 10);
    for (const level of ['zero', 'few', 'getby'] as const) {
      assert.equal(presetMinutes(level, 'work'), 15);
      assert.equal(presetMinutes(level, 'moving'), 15);
      assert.equal(presetMinutes(level, 'trip'), presetMinutes(level, null));
    }
  });

  test('the starting level becomes a low-confidence estimate the ladder already reads', () => {
    assert.deepEqual(startEstimate('zero'), { estimate: 'A0', confidence: 'low' });
    assert.deepEqual(startEstimate('few'), { estimate: 'A0', confidence: 'low' });
    assert.deepEqual(startEstimate('getby'), { estimate: 'A1', confidence: 'low' });
  });

  test('one seeded goal per reason, short enough to be kept whole', () => {
    assert.deepEqual(Object.keys(SEEDED_GOAL).sort(), REASONS.map((r) => r.key).sort());
    for (const goal of Object.values(SEEDED_GOAL)) {
      assert.ok(goal.length > 0 && goal.length <= MAX_GOAL_CHARS, `"${goal}" would be cut by the goal store`);
      assert.equal(guiltIn(goal), undefined, `guilt in "${goal}"`);
      assert.doesNotMatch(goal, /[—–]/);
    }
  });

  test('the plan shows the first three scenes with their can-dos, the minutes and the reminder as not on', () => {
    const fresh = planFor(freshPreAccountDraft());
    assert.deepEqual(
      fresh.scenes.map((scene) => scene.id),
      SCENE_SPINE.slice(0, 3),
      'a fresh plan does not open on the first three scenes of the spine',
    );
    for (const scene of fresh.scenes) {
      const mission = getMission(scene.id);
      assert.ok(mission);
      assert.equal(scene.canDoEn, mission.canDoEn, 'the can-do line is not the mission’s own');
      assert.equal(scene.titleEn, mission.titleEn);
      assert.equal(scene.titleFr, mission.title);
    }
    assert.equal(fresh.minutes, presetMinutes(DEFAULT_START_LEVEL, null));
    assert.equal(fresh.goal, null, 'a skipped reason still claims a goal');
    assert.equal(fresh.reminder.time, DEFAULT_REMINDER_TIME);
    assert.equal(fresh.reminder.clock, reminderTime(DEFAULT_REMINDER_TIME).gloss);
    assert.equal(fresh.reminder.note, REMINDER_NOT_ON);

    const chosen = planFor(draft({ startLevel: 'getby', reason: 'work', minutes: 5, reminderTime: 'morning' }));
    assert.deepEqual(chosen.scenes.map((s) => s.id), sceneOrder('getby').slice(0, 3));
    assert.equal(chosen.minutes, 5, 'a minutes answer the learner changed was overridden by the preset');
    assert.equal(chosen.goal, SEEDED_GOAL.work);
    assert.equal(chosen.reminder.time, 'morning');
  });

  test('the plan claims no level name, no date and no promised level', () => {
    const LEVEL = /\b(A0|A1|A2|B1|B2|C1|C2|CEFR|beginner|intermediate|advanced|fluent|fluency)\b/i;
    const DATE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|tomorrow|next week|in \d+ (days|weeks|months))\b/i;
    const PROMISE = /\b(you will be|you'll be (fluent|at)|guarantee|by the end)\b/i;
    const lines: string[] = [...PLAN_COPY];
    for (const level of START_LEVELS) {
      for (const reason of [null, ...REASONS.map((r) => r.key)]) {
        const view = planFor(draft({ startLevel: level.key, reason }));
        for (const scene of view.scenes) lines.push(scene.titleEn, scene.canDoEn);
        if (view.goal !== null) lines.push(view.goal);
        lines.push(view.reminder.note);
      }
    }
    for (const line of lines) {
      assert.doesNotMatch(line, LEVEL, `the plan names a level: "${line}"`);
      assert.doesNotMatch(line, DATE, `the plan names a date: "${line}"`);
      assert.doesNotMatch(line, PROMISE, `the plan promises an outcome: "${line}"`);
    }
  });

  test('plan copy is warm and plain, and the one line about streaks denies them', () => {
    assert.equal(NO_STREAKS, 'No streaks: miss a day and nothing breaks.');
    assert.equal(METHOD_STEPS.length, 3, 'the method is three short steps');
    assert.equal(TRIAL_LINE, '30 free minutes, no card needed');
    assert.equal(PLANS.trial.secondsPerPeriod / 60, 30, 'the trial no longer grants thirty minutes, so the save page line is untrue');
    assert.equal(PLANS.trial.priceUsd, 0, 'the trial costs money, so "no card needed" is untrue');
    for (const line of [...PLAN_COPY, ...START_LEVELS.flatMap((l) => [l.title, l.gloss]), ...REASONS.map((r) => r.title)]) {
      assert.doesNotMatch(line, /[—–]/, `em dash in "${line}"`);
      // The one sentence that exists to deny a streak has to say the word.
      if (line === NO_STREAKS) continue;
      assert.equal(guiltIn(line), undefined, `guilt in "${line}"`);
    }
    assert.ok(PLAN_COPY.includes(NO_STREAKS) && PLAN_COPY.includes(REMINDER_NOT_ON) && PLAN_COPY.includes(TRIAL_LINE));
  });

  test("the plan's first scene has a drawing of its own", () => {
    assert.equal(
      sceneIllustration(planFor(freshPreAccountDraft()).scenes[0]!.id),
      'place-cafe-counter',
      'a fresh plan opens on the first coffee, so it draws the counter',
    );
    // Whatever the answers, the plan opens on a scene, and that scene has a place drawing.
    for (const level of START_LEVELS) {
      const first = planFor(draft({ startLevel: level.key })).scenes[0];
      assert.ok(first !== undefined, `a ${level.key} plan has no first scene to draw`);
      assert.match(sceneIllustration(first.id), /^place-/, `a ${level.key} plan opens on a scene with no place drawing`);
    }
  });

  test('every scene the plan can show is a real mission with a can-do line', () => {
    for (const level of START_LEVELS) {
      for (const id of sceneOrder(level.key)) {
        assert.ok(MISSIONS.some((m) => m.id === id && m.canDoEn.length > 0), `${id} is not a mission with a can-do line`);
      }
    }
  });
});
