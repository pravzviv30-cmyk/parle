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
import { cadenceFrom } from '../myfrench/cadence.ts';
import {
  CADENCE_HIDE,
  CADENCE_NOTE,
  CADENCE_SHOW,
  PHRASEBOOK_COPY,
  PHRASEBOOK_TITLE,
  STOP_LABEL,
  cadenceToggleLabel,
  hasCadence,
  speakerLabel,
} from './phrasebookView.ts';

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
    // Stage 3: the set is an optional collection now, so the card is gated on a
    // read that has answered with words AND on the learner asking to see it.
    assert.match(FLAT, /hasCadence\(cadence\) && \(/, 'the cadence collection is drawn from an unanswered read');
    assert.match(FLAT, /cadenceOpen && <CadenceCard cadence=\{cadence\} \/>/, 'the cadence card is drawn without being asked for');

    // Built from the deck and the topics, by the modules that own each answer.
    // Saved conversations are the second known source (whole-app phase 1), so
    // the pack list rides along; the grouping is still phrasebook.ts's alone.
    assert.match(FLAT, /setBook\(buildPhrasebook\(deck, topics, now, packs\)\)/, 'the screen groups the phrases itself instead of asking phrasebook.ts');
    assert.match(FLAT, /setOneLine\(oneLineFrom\(\{ deck, now \}\)\)/, 'the screen deals the card itself instead of asking oneLine.ts');
    assert.match(FLAT, /setCadence\(cadenceFrom\(\{ deck \}\)\)/, 'the screen picks the connectors itself instead of asking cadence.ts');
    assert.match(FLAT, /book !== null && hasPhrases\(book\)/, 'a learner with no kept lines is shown an empty list under a heading');

    // The route's own picture, at the registry's size, and the heading from the
    // module rather than typed here.
    assert.doesNotMatch(FLAT, /<Art\b|SCREEN_ART/, 'the phrasebook must not draw retired scene art');
    assert.match(FLAT, /\{PHRASEBOOK_TITLE\}/, 'the screen types its own title, so nothing can read the copy back');

    // What left with the route, and must not come back: two figures over a list
    // the learner can see, and a hold mark beside every line they wrote.
    assert.ok(!SCREEN.includes('<Stat'), 'the phrasebook counts itself again; a total over a visible list is a number asking to be compared');
    assert.ok(!SCREEN.includes('hold'), 'a per-phrase hold mark is back, so a page of the learner’s own French reports on them while they read it');
  });

  test('saved phrases not yet recalled are their own block, after the retained lines and under their own name — Stage 1', () => {
    // Separate from "Yours in conversation", never inside it: the retained
    // groups are evidence, and a saved phrase is a promise until it is recalled.
    assert.match(FLAT, /book !== null && hasSaved\(book\) &&/, 'the saved block is drawn from an unanswered read, or on a length the screen works out itself');
    assert.match(FLAT, /<Label>\{SAVED_TITLE\}<\/Label>/, 'the saved block spells its own heading, or has none');
    assert.match(FLAT, /\{SAVED_NOTE\}/, 'the saved block does not say how a phrase joins the retained lines');
    assert.match(FLAT, /book\.saved\.map\(/, 'the saved phrases are not drawn');
    assert.ok(at('<Label>{LEDGER.rowsLabel}</Label>') < at('<Label>{SAVED_TITLE}</Label>'), 'saved phrases are drawn above the lines already recalled');
    assert.ok(at('<Label>{SAVED_TITLE}</Label>') < at('<CadenceCard cadence={cadence}'), 'the cadence set no longer closes the page');
    // The retained gate is unchanged, so a saved phrase alone never draws the retained heading.
    assert.match(FLAT, /book !== null && hasPhrases\(book\) &&/, 'the retained block lost its own gate');
    // And each saved line can be heard by the same labelled speaker.
    const saved = FLAT.slice(at('book.saved.map('));
    assert.match(saved.slice(0, 400), /<PhraseRow/, 'a saved line is drawn without the shared row and its speaker');
  });

  test('the cadence glossary is an optional collection, closed until the learner opens it — Stage 3', () => {
    // The learner's own lines lead. The authored connectors used to close the
    // page as a long open glossary under them; now they are one quiet row that
    // opens the set on request, so a page of the learner's French is not
    // followed by a longer page of somebody else's.
    assert.equal(cadenceToggleLabel(false), CADENCE_SHOW, 'the closed row does not offer to open the set');
    assert.equal(cadenceToggleLabel(true), CADENCE_HIDE, 'the open row does not offer to close the set');
    assert.notEqual(CADENCE_SHOW, CADENCE_HIDE, 'open and closed read the same, so nobody can tell which state it is in');
    for (const line of PHRASEBOOK_COPY) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—/, `"${line}" counts something or carries an em dash`);
    }
    for (const line of [CADENCE_SHOW, CADENCE_HIDE, CADENCE_NOTE]) {
      assert.ok(PHRASEBOOK_COPY.includes(line), `left out of the scanned list: ${line}`);
    }

    // Only a set with words in it gets a row: an empty one would be a door onto nothing.
    assert.equal(hasCadence(null), false, 'an unanswered read draws the row');
    assert.equal(hasCadence({ words: [], earned: 0 }), false, 'an empty set draws the row');
    assert.equal(hasCadence(cadenceFrom({ deck: [] })), true, 'the authored set on a first morning draws no row');

    // Closed by default, said to a screen reader, and toggled in place.
    assert.match(FLAT, /const \[cadenceOpen, setCadenceOpen\] = useState\(false\);/, 'the collection opens by default');
    assert.match(FLAT, /accessibilityState=\{\{ expanded: cadenceOpen \}\}/, 'the row does not say whether the set is open');
    assert.match(FLAT, /onPress=\{\(\) => setCadenceOpen\(\(open\) => !open\)\}/, 'the row does not toggle the set');
    assert.match(FLAT, /\{cadenceToggleLabel\(cadenceOpen\)\}/, 'the row spells its own words');
    assert.match(FLAT, /!cadenceOpen && <Text[^>]*>\{CADENCE_NOTE\}<\/Text>/, 'the closed row does not say what the set is');

    // And it comes after everything that is the learner's own.
    assert.ok(at('<OneLineCard') < at('cadenceToggleLabel(cadenceOpen)'), 'the collection is drawn above the one line to say');
    assert.ok(at('<Label>{LEDGER.rowsLabel}</Label>') < at('cadenceToggleLabel(cadenceOpen)'), 'the collection is drawn above the recalled lines');
    assert.ok(at('<Label>{SAVED_TITLE}</Label>') < at('cadenceToggleLabel(cadenceOpen)'), 'the collection is drawn above the saved lines');
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
