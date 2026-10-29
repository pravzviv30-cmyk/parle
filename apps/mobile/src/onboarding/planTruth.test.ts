/**
 * F916 and F917 (product review, Stream C, 2026-10-29): the plan says only what
 * the first run really does, and a self-reported starting point moves where the
 * learner starts without ever crediting a stage they skipped.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUEST_CAFE_SCENE, MISSIONS, SCENE_SPINE, getMission, missionStates } from '@luvani/core';
import { freshPreAccountDraft, startLevelChange, staleSkipAhead, withStartLevel, withoutSkip, type PreAccountOnboardingDraft } from './preAccountDraft.ts';
import {
  CONFIDENCE_OPTIONS, FOCUS_OPTIONS, GENTLE_PACE, METHOD_STEPS, START_LEVELS, REASONS,
  firstConversationLines, firstSceneFor, methodLines, planFor, sceneOrder, startEstimate,
} from './plan.ts';
import { placementFor } from './placement.ts';
import { profileFromDraft } from './createFromDraft.ts';
import { practicePreferencesOf } from '../profile/practicePreferences.ts';
import { statedLevelTitle } from '../settings/profileView.ts';
import { stagesFrom } from '../journey/journeyView.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { guiltIn } from '../copy/guilt.ts';

const draft = (extra: Partial<PreAccountOnboardingDraft>): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });
const LEVELS = [null, ...START_LEVELS.map((l) => l.key)] as const;
const REASON_KEYS = [null, ...REASONS.map((r) => r.key)] as const;
const NOW = new Date(2026, 9, 29, 12).getTime();

describe('F916: the plan says what really happens first', () => {
  test("the plan's first conversation line comes from scene 1", () => {
    // Verifier, 2026-10-29: a guest may tap "Create an account first" on the
    // consent sheet and skip the café, so the café is named only as what Start
    // live practice plays now, and scene 1 is named as the plan's first scene
    // on every path, because it is what the account opens on either way.
    for (const startLevel of LEVELS) for (const reason of REASON_KEYS) for (const skipAhead of [false, true]) {
      const d = draft({ startLevel, reason, ...(skipAhead ? { skipAhead } : {}) });
      const scene = getMission(firstSceneFor(startLevel, reason, skipAhead))!;
      assert.equal(planFor(d).scenes[0]!.id, scene.id, 'scene 1 of the plan is not the scene the account opens on');
      const guest = firstConversationLines(d, { guestScene: true });
      const signed = firstConversationLines(d, { guestScene: false });
      assert.equal(guest.tryNow, `Try it now: ${GUEST_CAFE_SCENE.titleEn.toLocaleLowerCase()}.`);
      assert.equal(signed.tryNow, null, 'a signed-in learner never plays the guest café');
      for (const line of [guest, signed]) {
        assert.equal(line.first, `First scene in your plan: ${scene.canDoEn.toLocaleLowerCase()}.`);
        assert.doesNotMatch(line.first, /first conversation/i);
        if (line.comingUp !== null) {
          assert.match(line.comingUp, /^Coming up: /);
          assert.notEqual(line.comingUp.slice('Coming up: '.length), line.first.slice('First scene in your plan: '.length));
        }
      }
      assert.deepEqual(guest.comingUp, signed.comingUp);
    }
    // A brand-new traveller: the opener first, the station next.
    const trip = firstConversationLines(draft({ startLevel: 'zero', reason: 'trip' }), { guestScene: true });
    assert.equal(trip.comingUp, `Coming up: ${getMission('mission:gare')!.canDoEn.toLocaleLowerCase()}.`);
    const plan = readFileSync(new URL('./PersonalPlan.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(plan, /firstPracticeScenario/, 'the plan still names the retired guest conversation');
    assert.match(plan, /lines\.tryNow !== null/);
  });

  test('the starting point chosen in onboarding shows in learning preferences', () => {
    for (const level of START_LEVELS) {
      const profile = profileFromDraft(draft({ startLevel: level.key, speakingConfidence: 'hesitant', practiceFocus: 'words' }), NOW);
      const prefs = practicePreferencesOf(profile);
      assert.equal(prefs.level, level.key);
      assert.equal(prefs.confidence, 'hesitant');
      assert.equal(prefs.focus, 'words');
      assert.equal(statedLevelTitle(prefs.level), level.title);
    }
    assert.equal(practicePreferencesOf(profileFromDraft(freshPreAccountDraft(), NOW)).level, null, 'an unanswered level is written as an answer');
  });

  test("the plan's method sentence never repeats a clause", () => {
    const CONCEPTS = /\b(translat\w*|model|ready|typ\w*|writing|help|out loud|aloud|replay\w*)\b/gi;
    for (const startLevel of LEVELS) for (const confidence of [null, ...CONFIDENCE_OPTIONS.map((o) => o.key)]) for (const focus of [null, ...FOCUS_OPTIONS.map((o) => o.key)]) {
      const d = draft({ startLevel, speakingConfidence: confidence, practiceFocus: focus });
      const { method, gentle } = methodLines(d);
      const shown = [method, gentle ?? '', METHOD_STEPS[0]!].join(' ');
      const seen = (shown.match(CONCEPTS) ?? []).map((w) => w.toLowerCase().replace(/^(translat|typ|replay).*/, '$1').replace(/^aloud$/, 'out loud'));
      assert.equal(new Set(seen).size, seen.length, `a repeated idea in "${shown}"`);
      const clauses = method.split(/[.,]/).map((c) => c.trim().toLowerCase()).filter(Boolean);
      assert.equal(new Set(clauses).size, clauses.length, `a repeated clause in "${method}"`);
      assert.equal(planFor(d).method, method);
      assert.equal(gentle, confidence === 'hesitant' ? GENTLE_PACE : null);
      for (const line of [method, gentle ?? '']) {
        assert.doesNotMatch(line, /[—–·]/);
        assert.equal(guiltIn(line), undefined);
      }
    }
  });
});

describe('F917: a starting point, never a credit', () => {
  test('a learner who can get by does not start at Starter', () => {
    assert.equal(placementFor('getby'), 'basics');
    assert.equal(placementFor('confident'), 'everyday');
    assert.equal(placementFor('zero'), null);
    assert.equal(placementFor('few'), null);
    const view = planFor(draft({ startLevel: 'getby' }));
    assert.equal(view.stage, 1);
    assert.equal(view.heading, 'You start at Basics');
    assert.deepEqual(startEstimate('getby'), { estimate: 'A1', confidence: 'low' });
    assert.ok(sceneOrder('getby').every((id) => getMission(id)!.cefr !== 'A0'), 'Basics still suggests Starter scenes');
    for (const reason of REASON_KEYS) assert.notEqual(getMission(firstSceneFor('getby', reason))!.cefr, 'A0', String(reason));
    assert.equal(planFor(draft({ startLevel: 'zero' })).heading, 'You start at Starter');
    const plan = readFileSync(new URL('./PersonalPlan.tsx', import.meta.url), 'utf8');
    assert.match(plan, /<BStageCard current=\{plan\.stage\} \/>/);
  });

  test('skip ahead starts the learner at Everyday', () => {
    const skipped = draft({ startLevel: 'getby', skipAhead: true });
    const view = planFor(skipped);
    assert.equal(view.stage, 2);
    assert.equal(view.heading, 'You start at Everyday');
    assert.equal(view.canSkipAhead, false, 'Skip ahead is offered again once taken');
    assert.equal(planFor(draft({ startLevel: 'getby' })).canSkipAhead, true);
    for (const level of ['zero', 'few', 'confident'] as const) assert.equal(planFor(draft({ startLevel: level })).canSkipAhead, false, level);
    assert.deepEqual(startEstimate('getby', true), { estimate: 'A2', confidence: 'low' });
    assert.ok(sceneOrder('getby', true).every((id) => ['A2', 'B1'].includes(getMission(id)!.cefr)));
    const profile = profileFromDraft(skipped, NOW);
    assert.equal(practicePreferencesOf(profile).placement, 'everyday');
    assert.equal(profile.brain.cefr.estimate, 'A2');
    // Skip ahead never changes the learner's own answer.
    assert.equal(practicePreferencesOf(profile).level, 'getby');
    const plan = readFileSync(new URL('./PersonalPlan.tsx', import.meta.url), 'utf8');
    assert.match(plan, /accessibilityLabel=\{skipLabel\}[^\n]*\n\s*style=\{\{ minHeight: 44, minWidth: 44/);
    // Verifier, 2026-10-29: Skip ahead can be undone, and a level change clears it.
    assert.equal(view.canUndoSkip, true);
    assert.equal(planFor(draft({ startLevel: 'getby' })).canUndoSkip, false);
    assert.equal(planFor(withoutSkip(skipped)).heading, 'You start at Basics');
    assert.equal(withStartLevel(skipped, 'getby').skipAhead, true, 'choosing the same level again dropped the skip');
    for (const level of ['zero', 'few', 'confident'] as const) {
      assert.equal(withStartLevel(skipped, level).skipAhead, undefined, level);
      assert.equal(withStartLevel(withStartLevel(skipped, level), 'getby').skipAhead, undefined, 'the skip came back with the level');
    }
    assert.equal(staleSkipAhead(draft({ startLevel: 'few', skipAhead: true })), true);
    assert.equal(staleSkipAhead(skipped), false);
    assert.match(plan, /staleSkipAhead\(draft\)/);
    assert.match(plan, /onSkipAhead\(!plan\.canUndoSkip\)/);
    const screen = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
    assert.match(screen, /onSkipAhead=\{\(skip\) => patch\(\{ skipAhead: skip \}\)\}/);
  });

  test('changing the starting level clears skip ahead', () => {
    // The screen's patch merges a change into the draft, so the change itself must clear the skip.
    const merge = (d: PreAccountOnboardingDraft, l: PreAccountOnboardingDraft['startLevel'] & string) => ({ ...d, ...startLevelChange(d, l) });
    const skipped = draft({ startLevel: 'getby', skipAhead: true });
    assert.equal(merge(skipped, 'getby').skipAhead, true, 'choosing the same level again dropped the skip');
    for (const level of ['zero', 'few', 'confident'] as const) {
      const back = merge(merge(skipped, level), 'getby');
      assert.notEqual(back.skipAhead, true, `the skip came back after ${level}`);
      assert.equal(planFor(back).heading, 'You start at Basics');
    }
    const screen = readFileSync(new URL('./PreAccountOnboarding.tsx', import.meta.url), 'utf8');
    assert.match(screen, /onPress=\{\(\) => choose\(startLevelChange\(draftRef\.current, v\.key\)\)\}/, 'the level question writes the level without clearing the skip');
    assert.match(screen, /\.\.\.startLevelChange\(draftRef\.current, edit\.startLevel\)/, 'the plan sheet writes the level without clearing the skip');
  });

  test('Journey never credits a stage the learner skipped', () => {
    const empty = missionStates(missionCompletionsFrom([]), [], NOW);
    const basics = stagesFrom(empty, 'basics');
    assert.deepEqual(basics.steps.map((s) => s.state), ['skipped', 'here', 'ahead', 'ahead', 'ahead']);
    assert.equal(basics.eyebrow, 'Basics stage');
    assert.match(basics.steps[0]!.accessibilityLabel, /Skipped, still open to visit/);
    const a1 = SCENE_SPINE.filter((id) => getMission(id)!.cefr === 'A1').length;
    assert.equal(basics.moveUp, `Earn all ${a1} Basics abilities to move up to Everyday.`);
    const everyday = stagesFrom(empty, 'everyday');
    assert.deepEqual(everyday.steps.map((s) => s.state), ['skipped', 'skipped', 'here', 'ahead', 'ahead']);
    assert.equal(everyday.skippedLine, 'Starter and Basics skipped, still open to visit.');
    // No placement: unchanged.
    assert.deepEqual(stagesFrom(empty).steps.map((s) => s.state), ['here', 'ahead', 'ahead', 'ahead', 'ahead']);
    // Earning every A1 scene from Basics moves the learner up, but Starter stays skipped.
    const stored = SCENE_SPINE.filter((id) => getMission(id)!.cefr === 'A1').map((id, i) => ({ id, at: NOW - i * 1000, rung: 4 as const }));
    const earnedA1 = stagesFrom(missionStates(missionCompletionsFrom(stored), [], NOW), 'basics');
    assert.deepEqual(earnedA1.steps.map((s) => s.state), ['skipped', 'done', 'here', 'ahead', 'ahead']);
    // A placement never lowers what was really earned.
    const allA0 = SCENE_SPINE.filter((id) => getMission(id)!.cefr === 'A0').map((id, i) => ({ id, at: NOW - i * 1000, rung: 4 as const }));
    assert.deepEqual(stagesFrom(missionStates(missionCompletionsFrom(allA0), [], NOW), 'basics').steps.map((s) => s.state), ['done', 'here', 'ahead', 'ahead', 'ahead']);
    assert.ok(MISSIONS.length > 0);
  });
});

describe('one rule picks the first scene', () => {
  test("the plan's first scene is the scene Home offers first", async () => {
    const { homeMissionFrom } = await import('../home/homeMission.ts');
    const { goalOf } = await import('./goalLine.ts');
    const { startAtOf } = await import('../profile/practicePreferences.ts');
    const { nextScene } = await import('@luvani/core');
    const empty = missionStates([], [], NOW);
    for (const level of START_LEVELS) for (const reason of [null, ...REASONS.map((o) => o.key)]) for (const skipAhead of [false, true]) {
      const d = draft({ startLevel: level.key, reason, skipAhead });
      const profile = profileFromDraft(d, NOW);
      const label = `${level.key}/${reason}/${skipAhead}`;
      const first = firstSceneFor(level.key, reason, skipAhead);
      assert.equal(planFor(d).scenes[0]?.id, first, label);
      assert.equal(goalOf(profile), reason, `${label}: the stored goal is the onboarding reason`);
      assert.equal(nextScene(empty, goalOf(profile), startAtOf(profile))?.mission.id, first, `${label}: core disagrees`);
      const hero = homeMissionFrom({ progress: empty, records: [], levelIndex: 0, goal: goalOf(profile), startAt: startAtOf(profile), now: NOW });
      assert.ok(hero?.kind === 'scene', label);
      assert.equal(hero.mission.id, first, `${label}: Home offers a different first scene`);
    }
  });
});
