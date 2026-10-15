/**
 * The plan the first run builds (come alive, README Part 5.C rows 1 to 5):
 * a card that holds only the learner's own answers, a daily goal with four
 * tiers and one honest "Suggested", and a reveal ring that draws the real
 * share. The screen half is read from source, because there is no renderer in
 * this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { evidence } from '../../../test/evidence.ts';
import { presetMinutes } from '../plan.ts';
import { freshPreAccountDraft, REASON_KEYS, START_LEVEL_KEYS, type PreAccountOnboardingDraft } from '../preAccountDraft.ts';
import { GOAL_TIERS, planCardLabel, planSlots, planToken, planTokens, ringShare, slotFor, suggestedMinutes, tierLabel } from './planModel.ts';
import { FIRST_RUN_COPY } from './copy.ts';

const fresh = (extra: Partial<PreAccountOnboardingDraft> = {}): PreAccountOnboardingDraft => ({ ...freshPreAccountDraft(), ...extra });

describe('the plan card and the daily goal', () => {
  test('the plan card holds only answers the learner gave and suggests only the goal their answers point at', () => {
    // Nothing is filled in for them.
    assert.deepEqual(planTokens(fresh()), [null, null, null, null], 'the plan card starts with an answer nobody gave');
    assert.deepEqual(planSlots(true), ['drink', 'reason', 'goal'], 'the short variant has a level slot it never asks for');
    assert.equal(planCardLabel(fresh()), 'Your French plan: 0 of 4 chosen.');
    const some = fresh({ drink: 'tea', reason: 'trip' });
    assert.deepEqual(planTokens(some).map((t) => t?.label ?? null), ['Tea', 'Trips', null, null]);
    assert.equal(planCardLabel(some), 'Your French plan: Tea, Trips. 2 of 4 chosen.');
    const all = fresh({ drink: 'coffee', reason: 'because', startLevel: 'zero', minutes: 20 });
    assert.deepEqual(planTokens(all).map((t) => t?.label), ['Coffee', 'Exploring', 'New to French', '20 min a day']);
    assert.equal(planToken(all, 'goal')?.dial, 4, 'an Intense goal does not draw a full dial');
    assert.equal(planToken(fresh({ minutes: 'none' }), 'goal')?.label, FIRST_RUN_COPY.chooseEachTime, 'a goal chosen each time reads as a target that is set');
    for (const reason of REASON_KEYS) assert.ok(planToken(fresh({ reason }), 'reason'), `${reason} has no token`);
    for (const startLevel of START_LEVEL_KEYS) assert.ok(planToken(fresh({ startLevel }), 'level'), `${startLevel} has no token`);
    assert.equal(slotFor('drink'), 'drink');
    assert.equal(slotFor('startLevel'), 'level');
    assert.equal(slotFor('minutes'), 'goal');
    assert.equal(slotFor('eligibilityConfirmed'), null, 'the age answer flies into the plan');

    // "Suggested" is a derivation from their own answers, never a choice made for them.
    for (const reason of [null, ...REASON_KEYS]) {
      for (const startLevel of START_LEVEL_KEYS) {
        const draft = fresh({ reason, startLevel });
        assert.equal(suggestedMinutes(draft), presetMinutes(startLevel, reason), 'the suggested tier is not the plan module\'s own derivation');
        assert.equal(draft.minutes, null, 'a goal is preselected');
      }
    }
    assert.equal(suggestedMinutes(fresh({ reason: 'work', startLevel: 'zero' })), 15);
    assert.equal(suggestedMinutes(fresh({ reason: 'food', startLevel: 'zero' })), 5);
    assert.equal(suggestedMinutes(fresh({ reason: 'trip', startLevel: 'few' })), 10);
    // Never from an answer nobody gave: where the level was not asked (the
    // short variant), only work or a move point at a tier.
    for (const reason of [null, ...REASON_KEYS]) {
      const unasked = suggestedMinutes(fresh({ reason, startLevel: null }));
      assert.equal(unasked, reason === 'work' || reason === 'moving' ? 15 : null, `${String(reason)} with no level answer suggests ${String(unasked)}`);
    }
    assert.equal(tierLabel(GOAL_TIERS[1]!, true), 'Regular, 10 minutes a day, suggested');
    assert.equal(tierLabel(GOAL_TIERS[1]!, false), 'Regular, 10 minutes a day');

    // The screen: the tag only where the derivation points, nothing selected
    // until tapped, and the plan card launches the flight (never a Chip here).
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /\[5, 10, 15, 20, 'none'\]/);
    assert.match(screen, /selected=\{draft\.minutes === minutes\}/);
    assert.match(screen, /onPress=\{\(\) => choose\(\{ minutes \}\)\}/, 'Choose each time is no longer an answer of its own');
    assert.match(screen, /<PersonalPlan draft=\{draft\}/);
    assert.doesNotMatch(screen, /<PlanCard|<Chip|<Label|<TokenFlight|useTokenFlight/, 'retired plan slots must not clutter the questions');
    const goal = evidence('apps/mobile/src/onboarding/firstRun/GoalTile.tsx');
    assert.match(goal, /accessibilityLabel=\{tierLabel\(tier, suggested\)\}/);
  });

  test('C names real minutes and interests without implying learning completion', () => {
    assert.deepEqual(GOAL_TIERS.map(t => t.minutes), [5, 10, 15, 20]);
    const plan = evidence('apps/mobile/src/onboarding/PersonalPlan.tsx');
    assert.match(plan, /const minutes = minutesOf\(draft\)/);
    assert.match(plan, /minutes === 'none' \? 'Choose each time' : `\$\{minutes\} minutes`/);
    assert.match(plan, /draft\.interests\.map/);
    assert.match(plan, /<BoldScene kind="plan"/);
    assert.match(evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx'), /accessibilityLabel="Adjust my plan" onPress=\{\(\) => open\('plan'\)\}/);
    assert.doesNotMatch(plan, /<ProgressRing|mastery|fluency|numberOfLines/);
    const motion = evidence('apps/mobile/assets/bold-rhythm/source/plan/scene.rml');
    assert.match(motion, /loopValue="loop"/);
    const renderer = evidence('apps/mobile/src/onboarding/motion/BoldScene.native.tsx');
    assert.match(renderer, /C2Scene/);
    const c2 = evidence('apps/mobile/src/onboarding/motion/C2Scene.tsx');
    assert.match(c2, /c2MotionRuns\(\{ active, visible, foreground, reduced \}\)/);
  });

  test('plan editing commits all six answers so new interests reach the live scenario', () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const save = screen.slice(screen.indexOf('const sheetFooter ='), screen.indexOf(") : surface === 'start' ?"));
    for (const key of ['reason', 'startLevel', 'minutes', 'speakingConfidence', 'practiceFocus']) {
      assert.ok(save.includes(`${key}: edit.${key}`), `Done must commit ${key}`);
    }
    assert.match(save, /interests: \[\.\.\.\(edit\.interests \?\? \[\]\)\]/);
  });

  test('the personal plan always reads its first authored practice rather than the latest attempt', () => {
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const plan = evidence('apps/mobile/src/onboarding/PersonalPlan.tsx');
    assert.match(screen, /page === 'plan' && <PersonalPlan draft=\{draft\}/);
    assert.match(plan, /const plan = planFor\(draft\);/);
    assert.match(plan, /firstPracticeScenario\(briefFromDraft\(draft\)\)/);
    assert.match(plan, /\{plan\.method\}/);
    assert.match(plan, /BOLD_GOALS\.find\(g => g\.key === draft\.reason\)/);
    assert.match(plan, /startingSupport\(draft\)/);
    assert.doesNotMatch(plan, /taskIndex|attempts|\btask\.(prompt|translation|title)\b/);
  });
});
