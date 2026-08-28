/**
 * The strictness dial — F185.
 *
 * Three coaching policies have been in the brain since the engine was written.
 * The eval measures all three. Every learner profile carries the chosen one.
 * And no learner has ever been able to choose: the field was overwritten by
 * whichever session had just finished, so it was a log of the last conversation
 * rather than a preference, and no screen in the app offered it. F184 stopped
 * the write-back and F183 makes the agent read what is stored; this is the part
 * a person can touch.
 *
 * Two halves, and the second is the one worth stating. A settings row that
 * writes to memory is a dial that resets on the next launch, so this drives the
 * real store: save it, read it back through the same door the app reads it
 * through, and check the choice is still there. `loadProfile` runs the version
 * chain and then `repairProfile` over the brain blob, and repair is allowed to
 * hand back a fresh profile when it does not like what it sees, which is
 * exactly where a preference would quietly go.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProfile } from '@parle/brain/profile';

import {
  DEFAULT_STRICTNESS,
  STRICTNESS_OPTIONS,
  STRICTNESS_ORDER,
  STRICTNESS_ROW,
  STRICTNESS_SUB,
  STRICTNESS_TITLE,
  strictnessLabel,
  strictnessOf,
  withStrictness,
  type Strictness,
} from './strictness.ts';
import { createStoredProfile, loadProfile, saveProfile, type StoredProfile } from '../profile/store.ts';
import { setActiveUser } from '../storage/scope.ts';

const NOW = Date.parse('2026-08-28T09:00:00Z');

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

describe('the strictness dial — the one preference the tutor already reads', () => {
  test('the profile tab turns the strictness dial and the store keeps the choice', async () => {
    // 1. The three are the brain's own three, in the brain's own words. A
    //    fourth vocabulary on the one surface a learner reads is how a setting
    //    comes to mean two different things in two places.
    assert.deepEqual([...STRICTNESS_ORDER], ['flow', 'balanced', 'strict'], 'the levels are not the ones the engine grades on');
    assert.deepEqual(
      STRICTNESS_OPTIONS.map((o) => o.value),
      [...STRICTNESS_ORDER],
      'the sheet offers a different set, or a different order, than the dial has',
    );
    assert.equal(
      createProfile().preferences.strictness,
      DEFAULT_STRICTNESS,
      'a fresh learner model and this screen disagree about what nobody choosing means',
    );

    // 2. Reading it. Never asked is the default, and so is anything unreadable:
    //    `repairProfile` carries unknown preference values through untouched,
    //    which is right there and is why the scepticism has to live here.
    assert.equal(strictnessOf(null), DEFAULT_STRICTNESS, 'no profile at all resolves to something else');
    assert.equal(strictnessOf(undefined), DEFAULT_STRICTNESS);
    assert.equal(strictnessOf(learner()), 'balanced', 'a new learner starts somewhere other than the middle');
    for (const junk of ['STRICT', 'gentle', '', 0, null, {}, ['strict']]) {
      const tampered = { ...learner(), brain: { ...learner().brain, preferences: { strictness: junk, lastScenarios: [] } } };
      assert.equal(
        strictnessOf(tampered as unknown as StoredProfile),
        DEFAULT_STRICTNESS,
        `${JSON.stringify(junk)} in the slot changed how the tutor treats somebody`,
      );
    }

    // 3. Writing it. One field, and the learner model around it untouched:
    //    everything else in there is evidence about a person that a settings
    //    screen has no business rewriting.
    const before = learner();
    const strict = withStrictness(before, 'strict');
    assert.equal(strictnessOf(strict), 'strict');
    assert.equal(strictnessLabel(strict), 'Strict', 'the row shows a name the sheet does not offer');
    assert.deepEqual(strict.brain.phrases, before.brain.phrases, 'setting the dial threw away what the tutor knew');
    assert.deepEqual(
      strict.brain.preferences.lastScenarios,
      before.brain.preferences.lastScenarios,
      'the dial rewrote the rest of the preferences block',
    );
    assert.equal(strict.name, before.name);
    assert.deepEqual({ ...strict, brain: null }, { ...before, brain: null }, 'the dial changed something outside the brain');
    assert.equal(strictnessOf(before), 'balanced', 'the write mutated the profile it was handed');

    // Every value is reachable, not just the one the test happens to pick.
    for (const value of STRICTNESS_ORDER) {
      assert.equal(strictnessOf(withStrictness(before, value)), value, `${value} cannot be set`);
    }

    // 4. And the store keeps it. Through `saveProfile` and back out through
    //    `loadProfile`, which is the door the app reads on every launch: the
    //    version chain and `repairProfile` both run on the way out.
    installDisk();
    setActiveUser('44444444-4444-4444-8444-444444444444');
    await saveProfile(withStrictness(learner(), 'strict'));
    const reloaded = await loadProfile();
    assert.ok(reloaded, 'the profile did not survive its own round trip');
    assert.equal(strictnessOf(reloaded), 'strict', 'the dial reset itself on the next launch');
    assert.equal(reloaded.name, 'Camille', 'and the learner kept everything else');

    // Turning it again replaces rather than accumulates, and lands on disk.
    await saveProfile(withStrictness(reloaded, 'flow'));
    const again = await loadProfile();
    assert.equal(strictnessOf(again), 'flow', 'a second turn of the dial was lost');

    // 5. The copy. Warm, short, and honest about what each one does: a setting
    //    whose description does not match its behaviour is worse than none.
    for (const option of [...STRICTNESS_OPTIONS.map((o) => o.label), ...STRICTNESS_OPTIONS.map((o) => o.gloss),
      STRICTNESS_ROW, STRICTNESS_TITLE, STRICTNESS_SUB]) {
      assert.ok(option.length > 0, 'a line on the dial is empty');
      assert.ok(!/[—–]/.test(option), `"${option}" carries an em dash`);
      assert.ok(!/\d/.test(option), `"${option}" counts at somebody`);
      assert.ok(
        !/\b(wrong|bad|mistake|error|fail|failed|must|sorry|strict about you)\b/i.test(option),
        `"${option}" scolds`,
      );
    }
    // The two ends say the two different things they do, so the choice is
    // informed rather than a word to guess at.
    const gloss = (value: Strictness): string => STRICTNESS_OPTIONS.find((o) => o.value === value)!.gloss;
    assert.match(gloss('flow'), /recap/i, 'the loosest setting never says where the rest of the coaching goes');
    assert.match(gloss('strict'), /while you talk|as it happens/i, 'the tightest setting never says it interrupts');
    assert.notEqual(gloss('flow'), gloss('balanced'), 'two settings describe themselves identically');
    assert.match(STRICTNESS_SUB, /next conversation/i, 'the sheet does not say when a change is felt');

    // 6. The wiring. There is no renderer in this suite, so the row and the
    //    sheet are read out of the file the way ConvoScreen.test.ts reads its
    //    own. A dial nothing renders is exactly the shape this defect had.
    const tab = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(
      tab,
      /<SettingsRow label=\{STRICTNESS_ROW\} value=\{strictnessLabel\(profile\)\} onPress=\{\(\) => setSheet\('strictness'\)\}/,
      'profile has no row for the dial, so the preference is unreachable again',
    );
    assert.match(tab, /sheet === 'strictness'/, 'the row opens a sheet that does not exist');
    assert.match(
      tab,
      /update\(withStrictness\(profile, option\.value\)\)/,
      'the sheet changes what is on screen without writing it down',
    );
    assert.match(tab, /selected=\{strictnessOf\(profile\) === option\.value\}/, 'the sheet does not show what is already set');
    assert.ok(
      !/preferences/.test(tab),
      'the tab reaches into the learner model itself instead of going through the one named door',
    );
  });
});
