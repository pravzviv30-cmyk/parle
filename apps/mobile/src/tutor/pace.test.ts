/**
 * The pace dial — F371, the app's half.
 *
 * The same story as the strictness dial one entry earlier. The engine has taken
 * a pace since `createConversation` was written, the prompt already branches on
 * it, and no learner has ever been able to ask: the field simply was not on any
 * screen. The agent's half is verified in `services/tutor-agent`; this is the
 * part a person can touch, and the part that has to survive a launch.
 *
 * The second half is the one worth stating, exactly as `strictness.test.ts`
 * states it: a settings row that writes to memory is a dial that resets on the
 * next launch. So the round trip is real. `loadProfile` runs the version chain
 * and then `repairProfile` over the brain blob, and repair is allowed to hand
 * back a fresh profile when it does not like what it sees, which is precisely
 * where a newly added preference key would quietly go.
 *
 * ## Why the copy is not checked with `guiltIn`
 *
 * `guiltIn` bans the substring `owe`, on purpose, because "you owed yourself
 * one" is the sentence this product promised never to write. "Tutor speaks
 * slower" contains it, and the row is a plain statement about the tutor with no
 * learner in it at all. So the copy is held to the same regex family the
 * strictness dial is held to, which is where the real risk is: a number, an em
 * dash, or a word that reads as a fault.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile } from '@luvani/brain/profile';

import { DEFAULT_PACE, PACE_ORDER, PACE_ROW, PACE_SUB, paceOf, withPace } from './pace.ts';
import { strictnessOf } from './strictness.ts';
import { createStoredProfile, loadProfile, saveProfile, type StoredProfile } from '../profile/store.ts';
import { setActiveUser } from '../storage/scope.ts';

const NOW = Date.parse('2026-09-01T09:00:00Z');

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One in-memory AsyncStorage, so the round trip is the real store's. */
function installDisk(): Map<string, string> {
  const map = new Map<string, string>();
  const shared = AsyncStorage as unknown as Record<string, unknown>;
  shared.getItem = (key: string): Promise<string | null> => Promise.resolve(map.get(key) ?? null);
  shared.setItem = (key: string, value: string): Promise<void> => {
    map.set(key, value);
    return Promise.resolve();
  };
  shared.removeItem = (key: string): Promise<void> => {
    map.delete(key);
    return Promise.resolve();
  };
  return map;
}

/**
 * A learner the tutor already knows something about.
 *
 * `lastScenarios` is filled in on purpose: it is the other half of the
 * preferences block, and a fixture where it is empty cannot tell the difference
 * between writing one field and replacing the whole block with a fresh one.
 */
function learner(): StoredProfile {
  const profile = createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null }, NOW);
  profile.brain.preferences.lastScenarios = ['Au café du coin', 'À la gare'];
  return profile;
}

describe('the pace dial — the second thing the engine already reads', () => {
  test('the profile tab sets the pace and the store keeps the choice — F371', async () => {
    // 1. The two values are the engine's own two, in the engine's own words.
    assert.deepEqual([...PACE_ORDER], ['normal', 'slow'], 'the pace is not the one the conversation engine takes');
    assert.equal(DEFAULT_PACE, 'normal', 'a learner who never asked gets a tutor that behaves differently');
    assert.equal(
      createProfile().preferences.pace,
      undefined,
      'a fresh learner model now carries a pace, so absent no longer means never asked',
    );

    // 2. Reading it. Never asked is normal, and so is anything unreadable:
    //    `repairProfile` carries unknown preference values through untouched,
    //    which is right there and is why the scepticism has to live here.
    assert.equal(paceOf(null), DEFAULT_PACE, 'no profile at all changed how the tutor talks');
    assert.equal(paceOf(undefined), DEFAULT_PACE);
    assert.equal(paceOf(learner()), 'normal', 'a new learner arrives already asking for something');
    for (const junk of ['SLOW', 'slower', 'gentle', '', 0, 1, true, null, {}, ['slow']]) {
      const tampered = {
        ...learner(),
        brain: { ...learner().brain, preferences: { strictness: 'balanced', lastScenarios: [], pace: junk } },
      };
      assert.equal(
        paceOf(tampered as unknown as StoredProfile),
        DEFAULT_PACE,
        `${JSON.stringify(junk)} in the slot changed how the tutor talks to somebody`,
      );
    }

    // 3. Writing it. One field, and the learner model around it untouched:
    //    everything else in there is evidence about a person that a settings
    //    screen has no business rewriting.
    const before = learner();
    const slow = withPace(before, 'slow');
    assert.equal(paceOf(slow), 'slow');
    assert.deepEqual(slow.brain.phrases, before.brain.phrases, 'asking for a slower tutor threw away what it knew');
    assert.deepEqual(
      slow.brain.preferences.lastScenarios,
      before.brain.preferences.lastScenarios,
      'the pace rewrote the rest of the preferences block',
    );
    assert.equal(strictnessOf(slow), strictnessOf(before), 'setting the pace moved the correction dial with it');
    assert.equal(slow.name, before.name);
    assert.deepEqual({ ...slow, brain: null }, { ...before, brain: null }, 'the pace changed something outside the brain');
    assert.equal(paceOf(before), 'normal', 'the write mutated the profile it was handed');

    // Both values are reachable, and asking again puts it back.
    for (const value of PACE_ORDER) {
      assert.equal(paceOf(withPace(before, value)), value, `${value} cannot be set`);
    }
    assert.equal(paceOf(withPace(withPace(before, 'slow'), 'normal')), 'normal', 'a learner cannot change their mind back');

    // 4. And the store keeps it. Through `saveProfile` and back out through
    //    `loadProfile`, which is the door the app reads on every launch: the
    //    version chain and `repairProfile` both run on the way out, and `pace`
    //    is the newest key in the block, so it is the one repair could drop.
    installDisk();
    setActiveUser('55555555-5555-4555-8555-555555555555');
    await saveProfile(withPace(learner(), 'slow'));
    const reloaded = await loadProfile();
    assert.ok(reloaded, 'the profile did not survive its own round trip');
    assert.equal(paceOf(reloaded), 'slow', 'the pace reset itself on the next launch');
    assert.equal(reloaded.name, 'Camille', 'and the learner kept everything else');
    assert.deepEqual(
      reloaded.brain.preferences.lastScenarios,
      ['Au café du coin', 'À la gare'],
      'repair kept the pace and dropped what was beside it',
    );

    // Turning it back replaces rather than accumulates, and lands on disk.
    await saveProfile(withPace(reloaded, 'normal'));
    const again = await loadProfile();
    assert.equal(paceOf(again), 'normal', 'a learner who asked for the ordinary pace back was not heard');

    // 5. The copy. Deliberately not `guiltIn`: it bans the substring `owe`,
    //    which lives inside "slower", and the row is a statement about the
    //    tutor with no learner in it. The real risks are checked instead.
    for (const line of [PACE_ROW, PACE_SUB]) {
      assert.ok(line.length > 0, 'a line on the pace row is empty');
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\d/.test(line), `"${line}" counts at somebody`);
      assert.ok(
        !/\b(wrong|bad|mistake|error|fail|failed|must|sorry|struggl|slow learner)\b/i.test(line),
        `"${line}" scolds, or reads as something about the learner rather than the tutor`,
      );
    }
    // 2026-09-27, notebook Phase 4 (report change 25): "slower" promised a
    // slower voice the cache never plays, so the row says what changes.
    assert.equal(PACE_ROW, 'Tutor speaks more simply', 'the row no longer names the tutor as the thing that changes');
    assert.doesNotMatch(PACE_ROW, /slow/i, 'the row promises a slower voice again');
    // What it promises is the prompt, not the waveform: the audio plays at the
    // speed the cache holds, so a claim about speech would be one the pipeline
    // does not keep.
    assert.match(PACE_SUB, /sentences/i, 'the row stopped saying what actually changes');
    assert.match(PACE_SUB, /first line/i, 'the row no longer says a change is felt from the opening line');
    assert.ok(
      !/\b(speed|slowly|slower speech|playback)\b/i.test(PACE_SUB),
      'the row promises slower audio, which the cached voice does not do',
    );

    // 6. The wiring. No renderer here, so the row is read out of the screen: a
    //    dial nothing renders is exactly the shape this defect had.
    // P2 (2026-10-19): the standing choices moved from Profile to Learning
    // preferences, one row away, unchanged in what they read and write.
    const tab = stripComments(read('../settings/LearningPreferencesScreen.tsx'));
    assert.match(tab, /withPace\(/, 'profile has no way to set the pace, so the preference is unreachable');
    assert.match(
      tab,
      /update\(withPace\(profile, next \? 'slow' : 'normal'\)\)/,
      'the switch moves on screen without writing the choice down',
    );
    assert.match(tab, /value=\{paceOf\(profile\) === 'slow'\}/, 'the switch does not show what is already set');
    assert.match(tab, /PACE_SUB/, 'the switch stands with no sentence saying what it does');
    assert.ok(
      !/preferences/.test(tab),
      'the tab reaches into the learner model itself instead of going through the one named door',
    );
  });
});
