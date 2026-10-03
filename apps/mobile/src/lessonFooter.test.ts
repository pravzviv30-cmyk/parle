/**
 * The lesson at the largest reading size — F462.
 *
 * The defect, in one sentence: `ScrollScreen` keeps `header` and `footer`
 * outside the scroll view, the lesson fills both, and at accessibility XXXL the
 * two grow until the card carrying the line the learner is being asked to say
 * has no room left and cannot be scrolled to. Two earlier repairs were real and
 * neither was enough, because the squeeze comes from the frame rather than from
 * the body: the body stopped being `flex: 1` with vertical centring, and the
 * lesson title stopped clipping to one line.
 *
 * What is left is the row of quiet text actions under the speak circle, which
 * at that size is a full line of screen each. It folds into one chip, and the
 * rule that decides when is `lessonFooter.ts` so it can be asked a question.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this is the usual
 * pair: the rule is run over the whole range of scales a platform can report,
 * and the surface is read as text to prove the screen actually wires it. That
 * second half is exactly how F274 survived being correct and invisible.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { FOLD_SCALE, MORE_HINT, MORE_LABEL, footerFolds, showsActionRow, soundNoteIn } from './lessonFooter.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const view = stripComments(read('./SessionView.tsx'));

describe('the lesson at the largest reading size — F462', () => {
  test('a lesson at the largest text size keeps the say-this card reachable', () => {
    // The ordinary reading sizes are untouched. A learner at 1.0 or at 1.3 sees
    // exactly the row they have always seen, so this buys its height from the
    // people who need it and from nobody else.
    for (const ordinary of [1, 1.1, 1.2, 1.35, FOLD_SCALE - 0.01]) {
      assert.equal(footerFolds(ordinary), false, `the row folded at ${ordinary}, which is not a large reading size`);
      assert.equal(showsActionRow(ordinary, false), true, `the actions vanished at ${ordinary} with nothing to open them`);
    }
    // And from the accessibility sizes up it folds, which is where the card
    // went off screen.
    for (const large of [FOLD_SCALE, 1.6, 2, 3.1]) {
      assert.equal(footerFolds(large), true, `the footer kept its full row at ${large}, which is the squeeze F462 records`);
      assert.equal(showsActionRow(large, false), false, `the row is still drawn at ${large}, so nothing was given back`);
      // Nothing is taken away, only moved one tap further: the same actions
      // come back when the chip is pressed.
      assert.equal(showsActionRow(large, true), true, `the chip at ${large} opens onto nothing`);
    }
    // A font scale is read off an OS and can be anything. A broken read is not
    // a tiny reading size, so it leaves the screen as it has always been drawn.
    for (const nonsense of [Number.NaN, Number.POSITIVE_INFINITY * 0, 0 / 0]) {
      assert.equal(footerFolds(nonsense), false, 'an unreadable font scale folded the row anyway');
    }

    // The screen's half. The rule is asked rather than re-derived, the chip is
    // the only other thing that can be drawn in that slot, and it says what it
    // does rather than what it is called.
    assert.match(view, /showsActionRow\(PixelRatio\.getFontScale\(\), moreOpen\)/, 'the lesson decides the fold for itself');
    assert.match(view, /\{actionRow \? \(/, 'the action row is not gated on the decision');
    assert.match(view, new RegExp(`accessibilityLabel=\\{MORE_HINT\\}`), 'the chip reaches a screen reader as a bare word');
    assert.match(view, /\{MORE_LABEL\}/, 'the chip has no word on it');
    assert.match(view, /setMoreOpen\(true\)/, 'the chip opens nothing');
    assert.equal(MORE_LABEL, 'More');
    assert.equal(MORE_HINT, 'Show the help controls for this line');

    // And the two ways this repair could be faked are both still banned here.
    // Clipping the type or capping the reading size would make the screen fit
    // and make the lesson unreadable, which is the trade `theme.ts` refuses
    // outright and which F462's own two earlier repairs already walked back.
    for (const cap of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'adjustsFontSizeToFit']) {
      assert.ok(!view.includes(cap), `the lesson caps its text with ${cap} instead of giving the body room`);
    }
    // The card the whole defect is about is still in the scroll body rather
    // than in the footer, which is where it has to be to be scrolled to.
    const footerAt = view.indexOf('const footer = (');
    const bodyAt = view.indexOf('<SupportBlock');
    assert.ok(footerAt !== -1 && bodyAt !== -1, 'the lesson no longer has a footer or a support block; this test is stale');
    assert.ok(bodyAt > footerAt, 'the say-this card moved into the footer, where it cannot be scrolled to');
  });
});

/**
 * The sound note above the microphone — notebook Phase 4 (B1), 2026-09-27.
 *
 * Each lesson turn can carry a note, and most of them are about a sound: the
 * nasal in "bonjour", the silent "t" in "croissant", the two R sounds in "par
 * carte". It used to sit at the very end of the scroll body, under the line to
 * say and the transcript, where a learner looking at the microphone never saw
 * it. Sound is the notebook's signature, so the note sits directly above the
 * mic footer while the learner has the floor. At the large reading sizes the
 * footer already folds (F462), so there the note stays in the body rather than
 * growing the footer back into the squeeze it was folded to avoid.
 */
describe('the sound note sits above the mic footer', () => {
  test('above the microphone while the learner has the floor, in the body at the large reading sizes', () => {
    const note = 'The "u" in "sur" needs rounded lips.';
    assert.equal(soundNoteIn(1, note, true), 'footer', 'the sound note is not above the microphone');
    assert.equal(soundNoteIn(FOLD_SCALE - 0.01, note, true), 'footer');
    assert.equal(soundNoteIn(FOLD_SCALE, note, true), 'body', 'the note grows a footer that folded to give the body room');
    assert.equal(soundNoteIn(1, note, false), null, 'the note is drawn while the tutor holds the floor');
    assert.equal(soundNoteIn(1, undefined, true), null);
    assert.equal(soundNoteIn(1, '   ', true), null, 'an empty note draws an empty line');
    assert.equal(soundNoteIn(Number.NaN, note, true), 'footer', 'an unreadable font scale moved the note');

    // The screen's half: the rule is asked once, the footer draws the note
    // above the rung row and the circle, and the body draws it only when told.
    assert.match(view, /const notePlace = soundNoteIn\(PixelRatio\.getFontScale\(\), prompt\.turn\.note, listening\);/);
    const footer = view.slice(view.indexOf('const footer = ('), view.indexOf('return (', view.indexOf('const footer = (')));
    const noteAt = footer.indexOf("notePlace === 'footer'");
    assert.notEqual(noteAt, -1, 'the footer never draws the sound note');
    assert.ok(noteAt < footer.indexOf('st.rungRow') && noteAt < footer.indexOf('<SpeakCircle'), 'the sound note is not above the mic footer');
    assert.match(view, /notePlace === 'body'/, 'at the large sizes the note has nowhere to go');
    assert.doesNotMatch(view, /prompt\.turn\.note && listening/, 'the note is still drawn at the foot of the body on its own condition');
  });
});
