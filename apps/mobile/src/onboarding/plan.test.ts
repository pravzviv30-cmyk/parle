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
  MINUTES_UNIT,
  NO_STREAKS,
  PLAN_COPY,
  REASONS,
  REMINDER_NOT_ON,
  SEEDED_GOAL,
  START_LEVELS,
  COVERAGE_NOTE,
  TRIAL_LINE,
  firstSceneFor,
  planFor,
  presetMinutes,
  reminderLine,
  sceneOrder,
  startEstimate,
  CONFIDENCE_OPTIONS,
  FOCUS_OPTIONS,
  startingSupport,
  initialPracticeMode,
  practiceForecast,
  tutorGoalsFor,
} from './plan.ts';

const draft = (extra: Partial<PreAccountOnboardingDraft>): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });

describe('answers to a plan', () => {
  test('scene order is the spine, and a learner who can get by skips the first coffee', () => {
    assert.deepEqual(sceneOrder('zero'), SCENE_SPINE);
    assert.deepEqual(sceneOrder('few'), SCENE_SPINE);
    assert.deepEqual(sceneOrder('getby'), SCENE_SPINE.filter((id) => id !== 'mission:premier-cafe'));
    assert.deepEqual(sceneOrder('confident'), sceneOrder('getby'));
    assert.equal(firstSceneFor('zero'), 'mission:premier-cafe');
    assert.equal(firstSceneFor('few'), 'mission:premier-cafe');
    assert.equal(firstSceneFor('getby'), 'mission:cafe');
    assert.equal(firstSceneFor('confident'), 'mission:cafe');
    assert.equal(firstSceneFor(null), 'mission:premier-cafe', 'an unanswered level starts at the start');
    // 2026-10-22 (review fix): a brand-new learner opens on the opener whatever
    // the goal, the same scene nextScene offers before anything is earned.
    for (const r of ['trip', 'moving', 'family', 'work', 'food', 'because'] as const) {
      assert.equal(firstSceneFor('zero', r), 'mission:premier-cafe', r);
      assert.equal(firstSceneFor('few', r), 'mission:premier-cafe', r);
      assert.equal(firstSceneFor(null, r), 'mission:premier-cafe', r);
    }
    // A learner who can get by starts on the first A0 or A1 scene of the goal.
    for (const l of ['getby', 'confident'] as const) {
      assert.equal(firstSceneFor(l, 'trip'), 'mission:gare');
      assert.equal(firstSceneFor(l, 'moving'), 'mission:voisin');
      assert.equal(firstSceneFor(l, 'family'), 'mission:amis');
      assert.equal(firstSceneFor(l, 'work'), 'mission:journee');
      assert.equal(firstSceneFor(l, 'food'), 'mission:cafe');
      assert.equal(firstSceneFor(l, 'because'), 'mission:cafe');
    }
    assert.equal(firstSceneFor('getby', null), 'mission:cafe');
  });

  test('preset minutes follow the level, and work or a move asks for fifteen', () => {
    assert.equal(presetMinutes('zero', null), 5);
    assert.equal(presetMinutes('few', null), 10);
    assert.equal(presetMinutes('getby', null), 10);
    for (const level of ['zero', 'few', 'getby', 'confident'] as const) {
      assert.equal(presetMinutes(level, 'work'), 15);
      assert.equal(presetMinutes(level, 'moving'), 15);
      assert.equal(presetMinutes(level, 'trip'), presetMinutes(level, null));
    }
  });

  test('the starting level becomes a low-confidence estimate the ladder already reads', () => {
    assert.deepEqual(startEstimate('zero'), { estimate: 'A0', confidence: 'low' });
    assert.deepEqual(startEstimate('few'), { estimate: 'A0', confidence: 'low' });
    assert.deepEqual(startEstimate('getby'), { estimate: 'A1', confidence: 'low' });
    assert.deepEqual(startEstimate('confident'), { estimate: 'A1', confidence: 'low' });
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
    // The plan page says the time and that it is off, in one line.
    assert.equal(reminderLine(fresh.reminder.clock), `Reminder at ${reminderTime(DEFAULT_REMINDER_TIME).gloss}, not on yet.`);
    assert.match(reminderLine(fresh.reminder.clock), /not on yet/, 'the reminder line reads as if it were set');
    assert.equal(MINUTES_UNIT, 'minutes a day');

    const chosen = planFor(draft({ startLevel: 'getby', reason: 'work', minutes: 5, reminderTime: 'morning' }));
    assert.deepEqual(chosen.scenes.map((s) => s.id), [firstSceneFor('getby', 'work'), ...sceneOrder('getby').filter(id => id !== firstSceneFor('getby', 'work'))].slice(0, 3));
    assert.equal(chosen.starter.id, 'colleague');
    assert.equal(chosen.minutes, 5, 'a minutes answer the learner changed was overridden by the preset');
    assert.equal(chosen.goal, SEEDED_GOAL.work);
    assert.equal(chosen.reminder.time, 'morning');
  });

  test('the plan bounds its beginner coverage without claiming a placement, completion date or promised level', () => {
    const LEVEL = /\b(A0|A1|A2|B1|B2|C1|C2|CEFR|beginner|intermediate|advanced|fluent|fluency)\b/i;
    const DATE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|tomorrow|next week|in \d+ (days|weeks|months))\b/i;
    const PROMISE = /\b(you will be|you'll be (fluent|at)|guarantee|by the end)\b/i;
    assert.match(COVERAGE_NOTE, /Beginner scenes/);
    assert.match(COVERAGE_NOTE, /starting level is a suggestion/);
    const lines: string[] = PLAN_COPY.filter(line => line !== COVERAGE_NOTE);
    for (const level of START_LEVELS) {
      for (const reason of [null, ...REASONS.map((r) => r.key)]) {
        const view = planFor(draft({ startLevel: level.key, reason }));
        for (const scene of view.scenes) lines.push(scene.titleEn, scene.canDoEn);
        if (view.goal !== null) lines.push(view.goal);
        lines.push(view.reminder.note, reminderLine(view.reminder.clock));
      }
    }
    for (const line of lines) {
      assert.doesNotMatch(line, LEVEL, `the plan names a level: "${line}"`);
      assert.doesNotMatch(line, DATE, `the plan names a date: "${line}"`);
      assert.doesNotMatch(line, PROMISE, `the plan promises an outcome: "${line}"`);
    }
  });

  test('plan copy is warm and plain, and the one line about streaks denies them', () => {
    // Revamp B (F601): the line denies a streak without naming a missed day or
    // a break, the words STYLE section 10 keeps out of practice copy.
    assert.equal(NO_STREAKS, 'A day off takes nothing away.');
    assert.doesNotMatch(NO_STREAKS, /\b(miss|missed|break|breaks|broken|streaks?)\b/i, 'the no-streak line names what it is meant to spare the learner');
    assert.equal(METHOD_STEPS.length, 3, 'the method is three short steps');
    assert.equal(TRIAL_LINE, '5 free minutes every week, no card needed');
    assert.equal(PLANS.trial.secondsPerPeriod / 60, 5, 'the free plan no longer grants five minutes, so the save page line is untrue');
    assert.equal(PLANS.trial.periodDays, 7, 'the free minutes no longer come every week, so the save page line is untrue');
    assert.equal(PLANS.trial.priceUsd, 0, 'the trial costs money, so "no card needed" is untrue');
    for (const line of [...PLAN_COPY, reminderLine('6:00 pm'), ...START_LEVELS.flatMap((l) => [l.title, l.gloss]), ...REASONS.map((r) => r.title)]) {
      assert.doesNotMatch(line, /[—–·]/, `a dash or a middot in "${line}"`);
      // The no-streak line no longer says the word, so it is held to the ban too.
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

describe('the extra personal questions change real support', () => {
  test('every confidence and focus answer produces support and bounded tutor goals', () => {
    assert.equal(START_LEVELS.length, 4);
    assert.equal(new Set(START_LEVELS.map(level => level.key)).size, 4);
    for (const confidence of CONFIDENCE_OPTIONS) for (const focus of FOCUS_OPTIONS) {
      const answer = draft({ reason: 'family', startLevel: 'confident', speakingConfidence: confidence.key, practiceFocus: focus.key });
      const view = planFor(answer);
      assert.equal(view.startingReason, startingSupport(answer));
      assert.equal(view.tutorGoals.length, 3);
      assert.equal(view.tutorGoals[0], SEEDED_GOAL.family);
      assert.deepEqual(view.tutorGoals, tutorGoalsFor(answer));
      for (const goal of view.tutorGoals) assert.ok(goal.length > 0 && goal.length <= MAX_GOAL_CHARS);
      if (confidence.key === 'hesitant') {
        assert.match(view.startingReason, /model and translation/);
        assert.equal(initialPracticeMode(answer), 'typed', 'hesitant learners are not put into speaking by their level');
      } else assert.equal(initialPracticeMode(answer), focus.key === 'speaking' ? 'spoken' : 'typed');
      if (focus.key === 'listening') assert.match(view.method, /Hear the model/);
      if (focus.key === 'words') assert.match(view.method, /useful words and translation/);
    }
    assert.deepEqual(tutorGoalsFor(freshPreAccountDraft()), []);
    assert.equal(initialPracticeMode(freshPreAccountDraft()), 'typed');
  });
  test('a commitment forecast is exact practice time without a promised proficiency', () => {
    for (const [minutes, hours] of [[5, 7.5], [10, 15], [15, 22.5], [20, 30]] as const) {
      const forecast = practiceForecast(minutes);
      assert.ok(forecast);
      assert.equal(forecast.days, 90);
      assert.equal(forecast.dailyMinutes, minutes);
      assert.equal(forecast.totalMinutes, minutes * 90);
      assert.equal(forecast.hours, hours);
      assert.match(forecast.line, new RegExp(`${hours} hours`));
      assert.doesNotMatch(forecast.line, /fluen|guarantee|you will|you’ll|months|conversation/i);
    }
    assert.equal(practiceForecast('none'), null);
    assert.equal(practiceForecast(null), null);
    assert.equal(practiceForecast(undefined), null);
  });
});
