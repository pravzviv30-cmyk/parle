/**
 * The phrase card, read as source — F569, F574.
 *
 * One French line with a way to hear it. The two things worth holding: the
 * speaker is a real button that says which of its two jobs it is about to do,
 * and the line is sized by `fitDisplay` rather than clipped.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const PHRASE = stripComments(read('./PhraseCard.tsx'));
const FLAT = PHRASE.replace(/\s+/g, ' ');

describe('the card that holds one French line — F569', () => {
  test('the speaker is one button at the touch floor that offers to stop what it is already playing', () => {
    // "Hear" on a sounding speaker is an offer to do the thing it is doing.
    // OptionCard's replay ear learned this; the phrase card inherits it.
    assert.equal((PHRASE.match(/<Pressable/g) ?? []).length, 1, 'the phrase card is not exactly one target');
    assert.match(FLAT, /accessibilityLabel=\{playing \? 'Stop' : 'Hear'\}/, 'the speaker says the same word whether it is playing or not');
    assert.match(FLAT, /accessibilityRole="button"/, 'the speaker does not announce itself as a button');
    assert.match(FLAT, /<SpeakerGlyph color=\{accent\.primary\} \/>/, 'the speaker mark is not the identity violet of a thing you press');
    assert.match(FLAT, /speaker: \{ width: HIT, height: HIT, borderRadius: HIT \/ 2, backgroundColor: paper\.card/, 'the speaker disc is under the touch floor, or writes its own size');
    assert.match(FLAT, /\.\.\.shadow\.whisper/, 'the speaker has no whisper under it, so a white disc on a white card is invisible');
    assert.doesNotMatch(PHRASE, /shadowOpacity|elevation:/, 'the speaker writes a shadow in numbers; there are two named shadows in this app');
  });

  test('the French is sized to fit rather than clipped, and the gloss stays quiet under it', () => {
    assert.match(FLAT, /fitDisplay\(french\)/, 'the French line is not sized by length, so a long one is set at the same size as a short one');
    assert.match(FLAT, /french: \{ color: paper\.ink/, 'the French line is not set in ink');
    assert.match(FLAT, /type\.small, \{ color: paper\.inkSoft \}\]\}>\{gloss\}/, 'the gloss is not the quiet soft line under the French');
    assert.match(FLAT, /\{control\}/, 'the card never draws the control it was handed');
    assert.ok(!PHRASE.includes('<PillButton'), 'the phrase card builds its own pill, so a screen can no longer be counted for one primary action');

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!PHRASE.includes(raw), `the phrase card writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(PHRASE, /#[0-9A-Fa-f]{6}/, 'the phrase card writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!PHRASE.includes(clip), `the phrase card uses ${clip}, so a learner who turns the text up loses the line`);
    }
  });
});
