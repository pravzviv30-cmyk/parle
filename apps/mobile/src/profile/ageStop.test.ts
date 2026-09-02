/**
 * The under-13 stop, from the frame that carries it to the door it closes.
 *
 * The defect this exists for is not that the stop is missing. Slice 1 built the
 * delivery half and it works: the agent decides, the `safety` frame arrives with
 * `category: 'under-13'`, and the whole screen becomes the stop. The defect is
 * that it lasted exactly one session. A child said "I'm 11", lost that session,
 * tapped start, and was in another scene seconds later — so the product's one
 * hard boundary was, in practice, a speed bump between one utterance and the
 * next.
 *
 * What closes it is one v5 profile field and four functions that already know
 * about each other:
 *
 *   isUnderAgeStop     the frame, recognised. `profile/age.ts`.
 *   withAgeStop        the account remembers it. `profile/store.ts`.
 *   entryFor           the navigator sends them back through the age gate.
 *                      `onboarding/answers.ts`.
 *   withAgeGatePassed  one tap on the gate is the way back in.
 *
 * The test drives all four rather than asserting on a stored field, because a
 * field nothing reads is exactly the shape this defect already had once.
 *
 * ## What is deliberately not claimed
 *
 * A reinstall clears the flag, and so does a second phone. That is the ceiling
 * the founder accepted rather than wait for the strong shape, and step 10 holds
 * it *positively*: the merge must never carry the stop to the account copy, and
 * must never be able to hand one back to a device that just cleared it. A future
 * change that quietly starts syncing it fails here and has to come back and say
 * so in the docs first.
 *
 * The other half of that ceiling, `adoptProfile` keeping this device's own stop
 * across a fold, is read as source rather than driven: it is inside the one
 * function in the file that touches AsyncStorage, which no test on plain node
 * can load. Named for what it is, the way `speech/discardRecording.test.ts`
 * names its own device check.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAFETY_CATEGORIES, type SafetyCategory } from '@luvani/core';
import { mergeStoredProfiles } from '@luvani/brain/profile/merge';

import { ageStopStanding, isUnderAgeStop } from './age.ts';
import {
  completeProfile,
  createStoredProfile,
  withAgeGatePassed,
  withAgeStop,
  type StoredProfile,
} from './store.ts';
import { SYNC_POLICIES } from '../sync/policy.ts';
import { upgradeStored } from './upgrade.ts';
import {
  AGE_CONFIRM,
  AGE_DENY,
  AGE_REFUSAL,
  AGE_RETURN_SUB,
  AGE_RETURN_TITLE,
  ageGate,
  entryFor,
} from '../onboarding/answers.ts';

const NOW = Date.parse('2026-08-27T10:00:00Z');
const LATER = NOW + 90_000;

/** A learner who finished onboarding and has been using the app. */
function learner(): StoredProfile {
  return createStoredProfile({ name: 'Sam', ageConfirmed: true, motivation: null }, NOW);
}

describe('an account that remembers an under-13 stop', () => {
  test('an under-13 stop closes the tutor doors until the age gate is passed again', () => {
    // 1. Before anything happens, the doors are open. Stated first so that
    //    every later assertion is a change rather than a coincidence.
    const before = learner();
    assert.equal(before.ageStopAt, null, 'a learner who has done nothing wrong carries no stop');
    assert.equal(ageStopStanding(before), false);
    assert.equal(entryFor(before), 'app', 'and the app is where they go');

    // 2. The frame slice 1 delivers, recognised. Both halves have to be true:
    //    the category AND the action. Nothing else on the wire closes a door.
    assert.equal(isUnderAgeStop({ category: 'under-13', action: 'stop' }), true);
    assert.equal(
      isUnderAgeStop({ category: 'under-13', action: 'redirect' }),
      false,
      'a redirect is the tutor steering the conversation, not the product closing',
    );
    for (const category of SAFETY_CATEGORIES.filter((c) => c !== 'under-13')) {
      assert.equal(
        isUnderAgeStop({ category, action: 'stop' }),
        false,
        `a ${category} stop ends its session and says nothing about who this product is for`,
      );
    }
    assert.equal(isUnderAgeStop(null), false, 'an ordinary session has no safety frame at all');
    assert.equal(isUnderAgeStop(undefined), false);

    // 3. The stop lands, and the account writes it down.
    const stopped = withAgeStop(before, NOW);
    assert.equal(stopped.ageStopAt, NOW, 'the moment is the record');
    assert.equal(ageStopStanding(stopped), true);
    assert.deepEqual(
      stopped.brain,
      before.brain,
      'nothing the tutor learned about this learner is thrown away by the stop',
    );
    assert.equal(stopped.name, before.name, 'and they are still the person they said they were');

    // 4. The doors are shut. This is the assertion the whole entry is about:
    //    the next launch does NOT reach the app, and it does not restart
    //    onboarding either, because they have already been through that.
    assert.equal(entryFor(stopped), 'age-gate');
    assert.notEqual(entryFor(stopped), 'app', 'the child is back in a scene seconds later');

    // 5. And it survives the disk. A flag that only lives in a hook is the
    //    defect this entry names, so it has to come back off a round trip
    //    through the version chain.
    const reloaded = upgradeStored(JSON.parse(JSON.stringify(stopped)) as unknown, LATER);
    assert.ok(reloaded, 'a stopped profile still upgrades');
    assert.equal(reloaded.version, 6);
    assert.equal(reloaded.ageStopAt, NOW, 'the stop is on the disk, not in a hook nothing clears');
    assert.equal(entryFor(reloaded), 'age-gate', 'so the doors are still shut on the next launch');

    // 6. The way back in is the age gate, and it is the same gate. A learner
    //    who cannot say they are thirteen gets the same full stop they would
    //    have got on their first run.
    assert.equal(ageGate(false).go, false, 'saying no is still a refusal, not a retry');
    assert.equal(ageGate(false).refusal, AGE_REFUSAL, 'and it is the same words, whichever door they came through');
    assert.equal(entryFor(stopped), 'age-gate', 'declining leaves them exactly where they were, with nothing taken');

    // 7. Passing it opens the doors, and only passing it.
    const passed = withAgeGatePassed(stopped);
    assert.equal(passed.ageStopAt, null);
    assert.equal(ageStopStanding(passed), false);
    assert.equal(entryFor(passed), 'app');
    assert.equal(passed.name, 'Sam', 'they did not lose their name to get back in');
    assert.deepEqual(passed.brain, before.brain, 'or anything the tutor knew about them');

    // 8. The other door into the same gate: a learner who goes through the
    //    whole flow again. Both doors clear the stop, or the two rules would
    //    drift and one of them would strand somebody.
    const throughOnboarding = completeProfile(stopped, { name: 'Sam', ageConfirmed: true, motivation: null }, LATER);
    assert.equal(throughOnboarding.ageStopAt, null, 'the age page is the age page, wherever it was reached from');
    assert.equal(entryFor(throughOnboarding), 'app');

    // A pass through that flow that did NOT answer the age question leaves the
    // stop where it is. Otherwise saving a name would open the tutor.
    const nameOnly = completeProfile(stopped, { name: 'Sam', motivation: null }, LATER);
    assert.equal(nameOnly.ageStopAt, NOW, 'only the age question answers the age question');
    assert.equal(entryFor(nameOnly), 'age-gate');

    // 9. A learner who has never been through onboarding at all still gets
    //    onboarding, stop or no stop. The gate lives inside it.
    assert.equal(entryFor(null), 'onboarding');
    const neverAsked = upgradeStored({ version: 1, motivation: 'travel', onboardedAt: 1, brain: {} }, NOW);
    assert.ok(neverAsked);
    assert.equal(entryFor(neverAsked), 'onboarding');

    // 10. The ceiling, held positively. The stop belongs to this device: a sync
    //     adoption on the stopped phone must not clear it, and the account copy
    //     must never carry it. Driven through the real merge with the real
    //     version chain, the way sync/policy.ts wires them.
    const deps = { upgrade: (blob: unknown, when: number) => upgradeStored(blob, when), now: LATER };
    const clone = (p: unknown): unknown => JSON.parse(JSON.stringify(p)) as unknown;
    const merge = (a: unknown, aAt: number, b: unknown, bAt: number) =>
      mergeStoredProfiles({ stored: a, savedAt: aAt }, { stored: b, savedAt: bAt }, deps);

    // Both orders and both weights, because the field is dropped rather than
    // chosen and the whole point is that no arrangement of the two sides brings
    // it back. Weight matters: taken by the ordinary rule this would ride with
    // the evidence-heavier side, so a fixture where the stopped phone is the
    // lighter one proves nothing at all.
    for (const [label, account] of [
      ['stopped phone heavier', merge(clone(stopped), LATER, clone(before), NOW)],
      ['stopped phone lighter', merge(clone(stopped), NOW, clone(before), LATER)],
      ['stopped phone second', merge(clone(before), NOW, clone(stopped), LATER)],
      ['both phones stopped', merge(clone(stopped), LATER, clone(withAgeStop(before, LATER)), LATER)],
    ] as const) {
      assert.ok(account, `${label}: the merge still produces a profile`);
      assert.equal(
        account.ageStopAt ?? null,
        null,
        `${label}: the account copy carries the stop, which is a claim about a server nobody has stood up`,
      );
    }

    // And the reverse, which is what makes the field usable at all. A remote
    // that still carries a stop — an older build pushed one, or a hand-rolled
    // payload — must not be able to hand it back to a learner who has just
    // passed the gate. If it could, clearing the flag would be a write of null
    // that any non-null always beat, and the only way back into the product
    // would be a reinstall.
    const staleRemote = clone(stopped);
    const backAgain = merge(clone(passed), NOW, staleRemote, LATER);
    assert.ok(backAgain);
    assert.equal(backAgain.ageStopAt ?? null, null, 'a learner who passed the gate is stopped again by a sync');

    // The device half of the same rule. `adoptProfile` is the only writer that
    // could clear a stop without the learner doing anything, and it is the one
    // function here that no node test can load.
    const storeSource = readFileSync(new URL('./store.ts', import.meta.url), 'utf8');
    const at = storeSource.indexOf('function adoptProfile');
    assert.ok(at >= 0, 'adoptProfile is gone, so the fold no longer has an owner and this reads nothing');
    const adopter = storeSource.slice(at, storeSource.indexOf('\n}', at));
    assert.match(
      adopter,
      /ageStopAt: own/,
      'adoptProfile writes the folded profile straight through, so the first sync cycle after a stop clears it',
    );

    // 11. The copy. A child meeting this must not be made to feel caught, and
    //     an adult the classifier misread must not be accused of anything.
    for (const line of [AGE_RETURN_TITLE, AGE_RETURN_SUB, AGE_CONFIRM, AGE_DENY]) {
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(wrong|bad|failed|must|sorry|caught|lied|banned|blocked)\b/i.test(line), `"${line}" scolds`);
      assert.ok(!/\b(you said|you told|claimed|admitted)\b/i.test(line), `"${line}" tells the learner what they said`);
    }
    assert.match(AGE_RETURN_SUB, /still here/, 'the return copy does not say the one thing anyone needs to hear');
  });

  test('the age stop is bounded, written by one door, and read by one door', () => {
    // Nothing here grows per session. A profile field that accumulates is a
    // profile that eventually will not fit in the places this one is sent, and
    // the correction for that is always more expensive than the bound.
    const twice = withAgeStop(withAgeStop(learner(), NOW), LATER);
    assert.equal(twice.ageStopAt, LATER, 'a second stop replaces the first');
    assert.equal(typeof twice.ageStopAt, 'number', 'and it is still one number, not a list of them');
    assert.equal(
      JSON.stringify(twice).length - JSON.stringify(withAgeStop(learner(), NOW)).length,
      JSON.stringify(LATER).length - JSON.stringify(NOW).length,
      'meeting the boundary twice costs the stored profile nothing',
    );

    // Junk in the slot reads as no stop, which is the same reading every other
    // field in the chain gets. The argument is in upgrade.ts and it is load
    // bearing: the alternative locks a real learner out over a mangled byte.
    for (const junk of ['2026-08-27', true, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
      const blob = { ...JSON.parse(JSON.stringify(withAgeStop(learner(), NOW))), ageStopAt: junk } as unknown;
      const read = upgradeStored(blob, LATER);
      assert.ok(read, `a profile carrying ${String(junk)} in the slot still upgrades`);
      assert.equal(read.ageStopAt, null, `${String(junk)} is not a moment, so it is not a stop`);
    }

    // Zero is a real moment on the epoch and must not be swallowed by a
    // falsiness check. This is the classic way a flag like this goes quiet.
    const atZero = upgradeStored({ ...JSON.parse(JSON.stringify(learner())), ageStopAt: 0 } as unknown, LATER);
    assert.ok(atZero);
    assert.equal(atZero.ageStopAt, 0);
    assert.equal(ageStopStanding(atZero), true, 'a stop at epoch zero is still a stop');
  });

  test('a build that predates version 5 declines a v5 profile rather than mangling it', () => {
    // The shipped v4 chain, frozen here the way merge.test.ts freezes it: this
    // is what a phone that has not taken the update is running, and it cannot
    // be imported because it no longer exists.
    const GOALS: ReadonlySet<unknown> = new Set([5, 10, 15]);
    function v4Chain(stored: unknown, now: number): Record<string, unknown> | null {
      if (typeof stored !== 'object' || stored === null) return null;
      const r = stored as Record<string, unknown>;
      if (r.version !== 1 && r.version !== 2 && r.version !== 3 && r.version !== 4) return null;
      return {
        version: 4,
        name: typeof r.name === 'string' ? r.name : null,
        dob: typeof r.dob === 'string' ? r.dob : null,
        ageConfirmed: r.ageConfirmed === true ? true : null,
        motivation: typeof r.motivation === 'string' ? r.motivation : null,
        dailyGoalMin: GOALS.has(r.dailyGoalMin) ? r.dailyGoalMin : null,
        onboardedAt: typeof r.onboardedAt === 'number' ? r.onboardedAt : now,
        username: typeof r.username === 'string' ? r.username : null,
        brain: r.brain,
      };
    }

    const v5 = JSON.parse(JSON.stringify(withAgeStop(learner(), NOW))) as Record<string, unknown>;
    const frozen = JSON.stringify(v5);

    // It declines rather than throwing, exactly as it does for any version it
    // has never heard of, and it does not touch the blob it was handed.
    assert.equal(v4Chain(v5, LATER), null, 'an older build reads a v5 profile as unreadable, and says so quietly');
    assert.equal(JSON.stringify(v5), frozen, 'and it does not rewrite what it could not read');

    // This build reads the same bytes whole. That is the actual promise: the
    // blob on disk survives being read by a build that cannot use it.
    const ours = upgradeStored(JSON.parse(frozen) as unknown, LATER);
    assert.ok(ours);
    assert.equal(ours.ageStopAt, NOW);
    assert.equal(ours.name, 'Sam');

    // And this build still reads everything the older one writes, which is the
    // direction that actually happens on a phone.
    const theirs = v4Chain(JSON.parse(frozen) as unknown, LATER);
    assert.equal(theirs, null);
    const v4Blob = v4Chain({ version: 4, name: 'Sam', ageConfirmed: true, onboardedAt: NOW, brain: {} }, NOW);
    assert.ok(v4Blob);
    const forward = upgradeStored(v4Blob, LATER);
    assert.ok(forward, 'a v4 blob written by an older build still upgrades');
    assert.equal(forward.version, 6);
    assert.equal(forward.ageStopAt, null, 'and it carries no stop, because its version predates the field');
    assert.equal(forward.ageConfirmed, true, 'while everything it did answer survives');

    // The cost of that decline is real and is written down rather than hidden.
    const chain = readFileSync(new URL('./upgrade.ts', import.meta.url), 'utf8');
    assert.match(
      chain,
      /older build/,
      'upgrade.ts no longer says what a v5 blob costs a build that predates it',
    );
  });

  test('the version this build syncs is the version this build writes', () => {
    // Found the hard way while building v5, and cheap to hold from here on. The
    // sync table declares the inner schema version each namespace writes, and a
    // build whose profile store has moved past its own declaration calls its own
    // merge output a newer schema and goes pull-quiet on every profile cycle,
    // forever, with nothing on fire and nothing in the log to say why.
    const profilePolicy = SYNC_POLICIES.find((entry) => entry.namespace === 'profile');
    assert.ok(profilePolicy, 'the profile namespace has no sync policy, so this reads nothing');
    assert.equal(
      profilePolicy.writes,
      learner().version,
      'sync/policy.ts declares a different profile schema version than profile/store.ts writes',
    );
  });

  test('every safety category is answered, so a ninth cannot arrive unclassified', () => {
    // `isUnderAgeStop` reads one name out of a union core owns. If the agent
    // learns a ninth category, this walks it and the reader stays honest about
    // which one it is looking for rather than pattern-matching a prefix.
    const closes = SAFETY_CATEGORIES.filter((category: SafetyCategory) =>
      isUnderAgeStop({ category, action: 'stop' }),
    );
    assert.deepEqual(closes, ['under-13'], 'exactly one category closes the tutor doors for the account');
  });
});
