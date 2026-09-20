/**
 * The end of a lesson, after revamp A — F584.
 *
 * This is the one screen in the app where digits are welcome, and the reason is
 * worth keeping straight: the no-numbers rule holds MID-SESSION, because a
 * count mid-session is a score and a score mid-session is pressure. A card
 * shown after the session is over that could not say "nine words" would be coy
 * rather than calm. So the four `Stat`s stay, and this suite is here to stop
 * somebody tidying them away on the strength of half the rule.
 *
 * What did change is surface: the vector postcard became the registry's raster
 * scene, so the end of a lesson and the end of a conversation show the same
 * picture at the same size; the scene's name leads at display size; and the
 * notebook is one white card of lines rather than a scatter of chips.
 *
 * No renderer in this suite (docs/TESTING.md), so the screen is read as text.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const card = stripComments(read('./SummaryScreen.tsx'));

describe('the end card wears revamp A and still counts — F584', () => {
  test('the end card keeps concrete practice facts without grading the learner with percentages', () => {
    const stats = card.match(/<Stat\b/g) ?? [];
    assert.equal(stats.length, 2, 'the revised recap shows words and speaking duration');
    assert.doesNotMatch(card, /summary\.(unassistedRate|speakingShare)/);
    for (const label of ['Words used', 'Longest turn']) {
      assert.ok(card.includes(`label="${label}"`), `the end card lost the "${label}" fact`);
    }
    // The three labels that name something no sentence on the card says. They
    // are held by labels.test.ts too; naming them here is what makes a future
    // restyle of this file fail beside the thing it broke.
    for (const label of ['Your practice today', 'Your notebook', 'Since you started']) {
      assert.ok(card.includes(`<Label>${label}</Label>`) || card.includes(`>${label}<`), `the end card lost the "${label}" label`);
    }
  });

  test('the end card draws the postcard from the art registry, at the registry size', () => {
    // One picture, one size, one renderer. `Art` is the only file allowed to
    // reach `Image`, and the registry is the one place a scene's dimensions
    // live, so the recap and the end card cannot drift apart by a caller
    // writing a width. The vector drawing it replaces took one.
    assert.match(card, /<Art name=\{SCREEN_ART\.recap\} \/>/, 'the end card no longer draws the registry postcard');
    assert.ok(!card.includes('RecapPostcard'), 'the vector postcard is back beside the registered one');
    assert.doesNotMatch(card, /width=\{\d+\}/, 'the end card writes a picture width, which the registry exists to own');
  });

  test('the end card leads with the scene as a heading, and keeps its one way back and its one pill', () => {
    assert.match(card, /accessibilityRole="header"[\s\S]{0,120}\{lesson\.title\}/, 'nothing on the end card announces itself as a heading');
    assert.equal((card.match(/<ScreenHeader\b/g) ?? []).length, 1, 'the end card has more or fewer than one way back');
    assert.match(card, /<ScreenHeader\s+back=/, 'the end card has no way back');
    const pills = (card.match(/<PillButton\b/g) ?? []).length;
    assert.equal(pills, 1, `the end card draws ${pills} primary pills; the drill is the one recommended next step`);
    assert.match(card, /<PillButton\s+label="Practise this sound"/, 'the end card lost the drill as its one primary');
  });
});
