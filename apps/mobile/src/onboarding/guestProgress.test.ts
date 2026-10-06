/**
 * What a first-run guest has, as plain data (`guestProgress.ts`).
 *
 * Two rules here. A twenty-minute daily goal (founder decision D5) never
 * reaches the starter service, which validates 5, 10, 15 and "choose each
 * time". And a kept first-run phrase is the task's natural line (F757): the
 * check accepts a short list of authored answers without checking spelling, so
 * the learner's own words can carry a typo into the phrasebook and onto Home.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStarter, starterTasks } from '@luvani/core';
import { evidence } from '../../test/evidence.ts';
import { keptPhrase, starterMinutes } from './guestProgress.ts';
import { PLAN_MINUTES } from './preAccountDraft.ts';
import { REASON_KEYS } from './preAccountDraft.ts';

describe('the starter minutes', () => {
  test('a twenty-minute goal runs as fifteen at the starter and nothing chosen runs as five', () => {
    assert.deepEqual([...PLAN_MINUTES], [5, 10, 15, 20, 'none'], 'the daily goal lost or gained a tier');
    assert.equal(starterMinutes(20), 15);
    for (const minutes of [5, 10, 15, 'none'] as const) assert.equal(starterMinutes(minutes), minutes);
    assert.equal(starterMinutes(null), 5);
    assert.equal(starterMinutes(undefined), 5);
    // Twenty runs the same three exchanges fifteen does, on every route.
    for (const reason of REASON_KEYS) {
      assert.deepEqual(
        starterTasks(reason, 'coffee', starterMinutes(20)).map((t) => t.id),
        starterTasks(reason, 'coffee', 15).map((t) => t.id),
      );
    }
    // Every door that sends minutes or builds the starter goes through the one mapping.
    assert.match(evidence('apps/mobile/src/onboarding/guestPractice.ts'), /minutes: starterMinutes\(plan\.minutes\)/, 'a twenty can reach the starter service, which refuses it');
    for (const file of ['PreAccountOnboarding.tsx', 'guestModel.ts', 'GuestAccountHandoff.tsx', 'plan.ts']) {
      const source = evidence(`apps/mobile/src/onboarding/${file}`);
      assert.doesNotMatch(source, /starterTasks\([^)]*\.minutes \?\? 5\)/, `${file} builds the starter from a goal the starter does not know`);
    }
  });
});

describe('a kept first-run phrase — F757', () => {
  test("a kept first-run phrase is the natural line, never the learner's unchecked spelling", () => {
    // An accepted reply with no accents and no punctuation is still accepted,
    // and is still not how the phrase is written.
    const [drink] = starterTasks('food', 'coffee', 5);
    assert.ok(drink);
    const typed = 'bonjour je vais prendre un cafe';
    assert.equal(checkStarter(drink, typed, 'typed').accepted, true, 'core no longer accepts the unaccented reply this test relies on');
    assert.equal(keptPhrase(drink), drink.model);
    assert.notEqual(keptPhrase(drink), typed, 'the unchecked spelling would be kept');
    for (const reason of REASON_KEYS) {
      for (const task of starterTasks(reason, 'tea', 15)) assert.equal(keptPhrase(task), task.model, `${task.id} keeps something other than its natural line`);
    }

    // Every place a first-run phrase is kept or shown as kept.
    const handoff = evidence('apps/mobile/src/onboarding/GuestAccountHandoff.tsx');
    assert.match(handoff, /fr: keptPhrase\(task\),/, 'the hand-off keeps something other than the natural line');
    assert.doesNotMatch(handoff, /fr: a\.feedback\.accepted \? a\.reply/, 'the hand-off keeps the learner\'s spelling again');
    assert.doesNotMatch(handoff, /attempts\.at\(-1\)\?\.reply/, 'the hand-off shows the learner\'s spelling as the kept phrase');
    const home = evidence('apps/mobile/src/onboarding/StarterContinuation.tsx');
    assert.match(home, /fr: keptPhrase\(task\),/, 'Home keeps something other than the natural line');
    assert.doesNotMatch(home, /fr: reply\.trim\(\)/, 'Home keeps the learner\'s spelling again');
    const screen = evidence('apps/mobile/src/onboarding/PreAccountOnboarding.tsx');
    const guestHome = screen.slice(screen.indexOf("{page === 'home' && ("));
    assert.ok(guestHome.length > 0, 'the guest home moved; this check reads nothing');
    assert.match(guestHome, /\{last\.feedback\.model\}/, 'the guest home no longer shows the natural line');
    assert.doesNotMatch(guestHome, /\{last\.reply\}|last\.feedback\.accepted \? last\.reply/, 'the guest home shows the learner\'s spelling as the phrase');
  });
});
