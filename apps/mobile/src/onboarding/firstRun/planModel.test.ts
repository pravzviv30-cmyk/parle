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
    assert.equal(planToken(fresh({ minutes: 'none' }), 'goal')?.label, 'Each day');
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
    assert.equal(tierLabel(GOAL_TIERS[1]!, true), 'Regular, 10 minutes a day, suggested');
    assert.equal(tierLabel(GOAL_TIERS[1]!, false), 'Regular, 10 minutes a day');

    // The screen: the tag only where the derivation points, nothing selected
    // until tapped, and the plan card launches the flight (never a Chip here).
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /suggested=\{tier\.minutes === suggested\}/);
    assert.match(screen, /selected=\{draft\.minutes === tier\.minutes\}/);
    assert.match(screen, /onPress=\{\(\) => choose\(\{ minutes: 'none' \}\)\}/, 'Choose each time is no longer an answer of its own');
    assert.match(screen, /<PlanCard draft=\{draft\} five=\{five\} flyFrom=\{flight\} \/>/);
    assert.doesNotMatch(screen, /<Chip|<Label|<TokenFlight|useTokenFlight/, 'the flight is launched from the screen rather than the plan card');
    assert.match(evidence('apps/mobile/src/onboarding/firstRun/PlanCard.tsx'), /flight\.launch\(\{/);
    const goal = evidence('apps/mobile/src/onboarding/firstRun/GoalTile.tsx');
    assert.match(goal, /suggested \? `\$\{tierLine\(tier\.minutes\)\}\. \$\{FIRST_RUN_COPY\.suggested\}` : tierLine\(tier\.minutes\)/);
  });

  test('the plan reveal draws the real daily minutes and plays only the plan-ready sound', () => {
    assert.deepEqual(GOAL_TIERS.map((t) => [t.minutes, t.quarters]), [[5, 1], [10, 2], [15, 3], [20, 4]]);
    assert.equal(ringShare(5), 0.25);
    assert.equal(ringShare(20), 1);
    assert.equal(ringShare('none'), 1, '"each day" draws a part ring as if it were a number');
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    assert.match(screen, /<PlanReveal minutes=\{minutesOf\(draft\)\} exchanges=\{tasks\.length\}/, 'the reveal counts something other than the real plan');
    assert.match(screen, /const planReady = \(\) => \{ playSfx\('select'\); tapSettled\(\); \};/, 'the plan is louder than one select and one settled tap');
    assert.equal((screen.match(/planReady\(\)/g) ?? []).length, 3, 'the plan-ready sound plays somewhere other than arriving on a new plan');
    assert.match(screen, /<View \{\.\.\.decorative\}> <OrbGlyph color=\{paper\.ink\} size=\{28\} \/> <\/View> <Text style=\{\[type\.body, \{ flex: 1 \}\]\}>\{STARTER_AI\}<\/Text>/, 'the AI line lost its orb or its words');
    const reveal = evidence('apps/mobile/src/onboarding/firstRun/PlanReveal.tsx');
    assert.match(reveal, /<CountUp to=\{minutes\}/);
    assert.match(reveal, /FIRST_RUN_COPY\.streakLine/);
    assert.doesNotMatch(reveal, /HeroNumber|Building|building|shimmer|playSfx|tick=/, 'the reveal fakes work or ticks');
  });
});
