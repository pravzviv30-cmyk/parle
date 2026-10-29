/**
 * F916 and F917 (product review, Stream C, 2026-10-29): the plan says only what
 * the first run really does, and a self-reported starting point moves where the
 * learner starts without ever crediting a stage they skipped.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUEST_CAFE_SCENE, MISSIONS, SCENE_SPINE, getMission, missionStates } from '@luvani/core';
import { freshPreAccountDraft, type PreAccountOnboardingDraft } from './preAccountDraft.ts';
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
    for (const startLevel of LEVELS) for (const reason of REASON_KEYS) {
      const d = draft({ startLevel, reason });
      // Before an account, the scripted guest café always plays first.
      const guest = firstConversationLines(d, { guestScene: true });
      assert.equal(guest.first, `Your first conversation: ${GUEST_CAFE_SCENE.titleEn.toLocaleLowerCase()}.`);
      // Signed in, the scene firstSceneFor opens is the one played, so it is the one named.
      const signed = firstConversationLines(d, { guestScene: false });
      const scene = getMission(firstSceneFor(startLevel, reason, d.skipAhead === true))!;
      assert.equal(signed.first, `Your first conversation: ${scene.canDoEn.toLocaleLowerCase()}.`);
      assert.equal(planFor(d).scenes[0]!.id, scene.id, 'scene 1 of the plan is not the scene the account opens on');
      for (const line of [guest, signed]) {
        if (line.comingUp !== null) assert.match(line.comingUp, /^Coming up: /);
        assert.notEqual(line.comingUp?.slice('Coming up: '.length), line.first.slice('Your first conversation: '.length));
      }
    }
    // A traveller who can get by: the café now, the station next.
    const trip = firstConversationLines(draft({ startLevel: 'getby', reason: 'trip' }), { guestScene: true });
    assert.equal(trip.comingUp, `Coming up: ${getMission('mission:gare')!.canDoEn.toLocaleLowerCase()}.`);
    const plan = readFileSync(new URL('./PersonalPlan.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(plan, /firstPracticeScenario/, 'the plan still names the retired guest conversation');
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
    assert.match(plan, /accessibilityLabel=\{SKIP_AHEAD\}[^>]*minHeight: 44/);
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
