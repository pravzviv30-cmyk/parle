/**
 * The Phrasebook route, read as source — F575.
 *
 * It was an early return inside My French with a back arrow made of component
 * state; it is a stack route now. What is worth holding is the order (the one
 * line to say is above the list of lines already said), that every phrase can
 * be heard by a name a screen reader can tell apart, and that the two Stats and
 * the per-phrase hold marks are gone: a page of the learner's own French is not
 * a report on how well they are holding it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { PHRASEBOOK_TITLE, STOP_LABEL, speakerLabel } from './phrasebookView.ts';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const SCREEN = stripComments(read('./PhrasebookScreen.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const at = (needle: string): number => {
  const index = FLAT.indexOf(needle);
  assert.notEqual(index, -1, `${needle} is not on the phrasebook at all`);
  return index;
};

describe('your phrases, as a route of its own — F575', () => {
  test('the phrasebook opens on one line right now and closes on the cadence set', () => {
    // The order is the argument. One card asking for French sits above every
    // line already earned, and the authored connectors close the page so a
    // first morning ends on something to use rather than on an empty list.
    assert.match(FLAT, /<OneLineCard line=\{oneLine\} onGraded=\{\(\) => setGraded\(\(n\) => n \+ 1\)\} \/>/, 'the one line card is gone, or no longer re-reads the deck it just graded');
    assert.ok(at('<OneLineCard') < at('<Label>{LEDGER.rowsLabel}</Label>'), 'the lines already said are drawn above the one line the visit asks for');
    assert.ok(at('<CadenceCard cadence={cadence}') > at('<Label>{LEDGER.rowsLabel}</Label>'), 'the cadence set no longer closes the page');
    assert.match(FLAT, /oneLine !== null && <OneLineCard/, 'an empty deck still deals a card');
    assert.match(FLAT, /cadence !== null && <CadenceCard/, 'the cadence card is drawn from an unanswered read');

    // Built from the deck and the topics, by the modules that own each answer.
    assert.match(FLAT, /setBook\(buildPhrasebook\(deck, topics, now\)\)/, 'the screen groups the phrases itself instead of asking phrasebook.ts');
    assert.match(FLAT, /setOneLine\(oneLineFrom\(\{ deck, now \}\)\)/, 'the screen deals the card itself instead of asking oneLine.ts');
    assert.match(FLAT, /setCadence\(cadenceFrom\(\{ deck \}\)\)/, 'the screen picks the connectors itself instead of asking cadence.ts');
    assert.match(FLAT, /book !== null && hasPhrases\(book\)/, 'a learner with no kept lines is shown an empty list under a heading');

    // The route's own picture, at the registry's size, and the heading from the
    // module rather than typed here.
    assert.match(FLAT, /<Art name=\{SCREEN_ART\.phrasebook\}/, 'the phrasebook scene is gone, or is named by a filename at the call site');
    assert.match(FLAT, /\{PHRASEBOOK_TITLE\}/, 'the screen types its own title, so nothing can read the copy back');

    // What left with the route, and must not come back: two figures over a list
    // the learner can see, and a hold mark beside every line they wrote.
    assert.ok(!SCREEN.includes('<Stat'), 'the phrasebook counts itself again; a total over a visible list is a number asking to be compared');
    assert.ok(!SCREEN.includes('hold'), 'a per-phrase hold mark is back, so a page of the learner’s own French reports on them while they read it');
  });

  test('every phrase can be heard by a name a screen reader can tell apart, and the voice stops when the screen goes', () => {
    assert.equal(speakerLabel("C'est combien ?", false), "Hear C'est combien ?", 'the resting speaker does not say which line it will say');
    assert.equal(speakerLabel("C'est combien ?", true), STOP_LABEL, 'the sounding speaker offers to play something that is already playing');
    assert.notEqual(speakerLabel('a', false), speakerLabel('b', false), 'two speakers reach a screen reader as the same button');

    assert.match(FLAT, /accessibilityLabel=\{speakerLabel\(phrase\.front, playing\)\}/, 'the speaker is unlabelled, or labels itself');
    assert.match(FLAT, /accessibilityRole="button"/, 'the speaker does not announce itself as a button');
    assert.match(FLAT, /width: HIT, height: HIT, borderRadius: HIT \/ 2/, 'the speaker is under the touch floor, or sized by a number rather than the token');
    assert.match(FLAT, /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/, 'a voice started here follows the learner onto the next screen (F304)');

    assert.equal(guiltIn(PHRASEBOOK_TITLE), undefined, `"${PHRASEBOOK_TITLE}" carries "${guiltIn(PHRASEBOOK_TITLE)}"`);
    assert.doesNotMatch(PHRASEBOOK_TITLE, /\d|—/, 'the title counts something, or carries an em dash');
  });

  test('the route wears the one frame and shows one way back', () => {
    assert.equal((SCREEN.match(/<ScrollScreen\b/g) ?? []).length, 1, 'the route is not built on the shared scrolling frame');
    assert.equal((SCREEN.match(/<ScreenHeader\b/g) ?? []).length, 1, 'a pushed screen shows exactly one way back');
    assert.match(FLAT, /<ScreenHeader back=\{\{ onPress: onBack \}\} \/>/, 'the header is not the shared back');
    for (const own of ['useSafeAreaInsets', '<ScrollView', '<ChevronLeft', 'accessibilityLabel="Back"', '<FlatList']) {
      assert.ok(!SCREEN.includes(own), `the route re-derives ${own} instead of taking it from the frame`);
    }
    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!SCREEN.includes(raw), `the route writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(SCREEN, /#[0-9A-Fa-f]{6}/, 'the route writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!SCREEN.includes(clip), `the route uses ${clip}, so a learner who turns the text up loses words`);
    }
    assert.doesNotMatch(SCREEN, /—/, 'the route carries an em dash, which no learner-facing file may');
  });
});
