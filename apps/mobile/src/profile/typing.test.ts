/**
 * Prefer typing, on the app's side of the store — F370.
 *
 * `store.ts` holds the field and `upgrade.ts` carries it across versions; both
 * have their own suites. What is left is the reading, which has to be sceptical
 * for the same reason `strictnessOf` is, and the two sentences the row shows.
 *
 * The sub-line is the part with a product invariant behind it. A learner is
 * never forced to speak aloud, and the mirror of that promise is that they are
 * never quietly stopped from speaking either: this setting opens a box, and the
 * circle, the tutor's voice and the whole scene are unchanged. If the sentence
 * stopped saying so, the switch would read as "turn the conversation off", and
 * the first person to flip it would find a product they did not buy.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PREFER_TYPING_ROW, PREFER_TYPING_SUB, prefersTyping } from './typing.ts';
import { createStoredProfile, withPreferTyping, type StoredProfile } from './store.ts';

const NOW = Date.parse('2026-09-01T09:00:00Z');

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const learner = (): StoredProfile =>
  createStoredProfile({ name: 'Camille', ageConfirmed: true, motivation: null }, NOW);

describe('preferring the keyboard, as the app reads it — F370', () => {
  test('the typing row says the circle is still there, and only a stored yes counts — F370', () => {
    // 1. Reading it. Only the literal true is yes. A blob that has been round a
    //    sync, a version chain and another device's disk can carry anything at
    //    all in this slot, and every one of those is somebody who never asked.
    assert.equal(prefersTyping(null), false, 'no profile at all opens the keyboard over a voice product');
    assert.equal(prefersTyping(undefined), false);
    assert.equal(prefersTyping(learner()), false, 'a new learner is moved to the keyboard without asking');
    for (const junk of ['true', 1, {}, [], 'yes', 'false', 0, null]) {
      const tampered = { ...learner(), preferTyping: junk } as unknown as StoredProfile;
      assert.equal(prefersTyping(tampered), false, `${JSON.stringify(junk)} in the slot read as a choice`);
    }
    assert.equal(prefersTyping(withPreferTyping(learner(), true)), true, 'a learner who asked was not heard');
    assert.equal(prefersTyping(withPreferTyping(withPreferTyping(learner(), true), false)), false, 'changing back was lost');

    // 2. The sentence, and the promise inside it. Every spoken path in this
    //    product has a quiet twin, and this is not it: the microphone is one
    //    tap away on the circle it always was, and the row has to say so.
    assert.match(PREFER_TYPING_SUB, /circle/i, 'the row stopped promising the circle, so this reads as losing the voice');
    assert.match(PREFER_TYPING_SUB, /still/i, 'the row no longer says the spoken way is unchanged');
    assert.match(PREFER_TYPING_SUB, /keyboard/i, 'the row never says what turning it on actually does');
    assert.ok(
      !/\b(instead of|no more|without) (speaking|talking|your voice)\b/i.test(PREFER_TYPING_SUB),
      'the row offers to take the voice away, which is a different setting than this one',
    );

    // 3. The copy rules the whole surface keeps.
    for (const line of [PREFER_TYPING_ROW, PREFER_TYPING_SUB]) {
      assert.ok(line.length > 0, 'a line on the typing row is empty');
      assert.ok(!/[—–]/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\d/.test(line), `"${line}" counts at somebody in a settings label`);
      assert.ok(!/\b(wrong|bad|failed|must|should|sorry|unable)\b/i.test(line), `"${line}" scolds or apologises`);
    }
    assert.equal(PREFER_TYPING_ROW, 'Prefer typing', 'the row is named something other than what it does');

    // 4. The wiring, read out of the screen: there is no renderer here, and a
    //    stored preference nothing offers is the shape the strictness dial had.
    const tab = stripComments(read('../tabs/ProfileTab.tsx'));
    assert.match(tab, /<SwitchRow/, 'the row is not a switch on the card, so the choice is unreachable');
    assert.match(
      tab,
      /update\(withPreferTyping\(profile, next\)\)/,
      'the switch moves on screen without writing the choice down',
    );
    assert.match(tab, /value=\{prefersTyping\(profile\)\}/, 'the switch does not show what is already stored');
    assert.match(tab, /PREFER_TYPING_SUB/, 'the switch stands with no sentence, so its consequences are found by flipping it');
  });
});
