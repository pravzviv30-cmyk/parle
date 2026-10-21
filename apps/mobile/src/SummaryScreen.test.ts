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

  test('the end card wears the notebook: no postcard, no feature paper, no ink outline', () => {
    // 2026-09-27, notebook Phase 4 (B1). The recap-postcard raster retires with
    // the redesign's imagery (the recap and this card both drew it), and the
    // head that sat on chartreuse feature paper inside an ink outline is plain
    // paper now: the scene's name leads, and the chartreuse is a highlighter.
    assert.ok(!card.includes('<Art'), 'the end card still draws the retired postcard');
    assert.ok(!card.includes('SCREEN_ART'), 'the end card still reaches for a screen picture');
    assert.ok(!card.includes('RecapPostcard'), 'the vector postcard is back');
    assert.doesNotMatch(card, /accent\.feature/, 'the end card still stands on feature paper');
    assert.doesNotMatch(card, /borderColor: paper\.ink/, 'the end card still draws an ink outline');
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

/**
 * Whole-app Stage 3A (2026-09-25): what went well, one focus, practise it,
 * Done. Review, the Anki export, the notebook, the long-run headlines and
 * another go at the conversation stay, behind one closed More. A sound is met
 * as a word first; the symbol and the scorer's reason are an optional detail.
 */
describe('the end card reads in the order a learner needs it', () => {
  const render = card.slice(card.indexOf('return ('));
  const at = (marker: string): number => {
    const i = render.indexOf(marker);
    assert.notEqual(i, -1, `\`${marker}\` is not on the end card at all`);
    return i;
  };

  test('win, focus, practise, done, then one closed More holding everything else', () => {
    assert.ok(at('<Label>Your practice today</Label>') < at('<Label>One sound to practise next</Label>'), 'the win is drawn after the focus');
    assert.ok(at('<Label>One sound to practise next</Label>') < at('label="Practise this sound"'), 'the practice comes before the focus');
    assert.ok(at('label="Practise this sound"') < at('label="Finish lesson"'), 'Done comes before the practice');
    assert.ok(at('label="Finish lesson"') < at('expanded: more'), 'More is drawn before Done, so opening it pushes the way out down the screen');

    assert.match(card, /const \[more, setMore\] = useState\(false\);/, 'More opens by itself');
    assert.equal((card.match(/accessibilityState=\{\{ expanded: more \}\}/g) ?? []).length, 1, 'there is not exactly one More disclosure');
    const more = render.slice(render.indexOf('{more && ('));
    assert.ok(render.includes('{more && ('), 'nothing is behind More');
    // 2026-10-21 UI-008: the label's colour is the theme's text token now (t.text), so the end card reads in dark.
    for (const secondary of ['label="Review"', 'label="Export to Anki"', 'label="Practise the conversation again"', '<Label>Your notebook</Label>', '<Label color={t.text}>Since you started</Label>']) {
      assert.ok(more.includes(secondary), `${secondary} is not behind More`);
      assert.equal(render.indexOf(secondary), render.lastIndexOf(secondary), `${secondary} is drawn outside More as well`);
    }
  });

  test('the focus sound leads with a word, and its symbol and reason are an optional detail', () => {
    const focus = render.slice(at('<Label>One sound to practise next</Label>'), at('label="Practise this sound"'));
    assert.match(focus, /\{soundInWord\(focusWord\)\}/, 'the focus does not lead with an example word');
    assert.ok(focus.indexOf('{soundInWord(focusWord)}') < focus.indexOf('focus.phoneme.ipa'), 'the notation comes before the word');
    assert.match(card, /const \[soundDetail, setSoundDetail\] = useState\(false\);/, 'the symbol is shown before anyone asks');
    // Every notation on the focus and the drill is behind the toggle.
    for (const notation of ['/{focus.phoneme.ipa}/', '/{i.ipa}/', '{focus.reason}']) {
      const i = focus.indexOf(notation);
      assert.notEqual(i, -1, `${notation} is gone rather than made optional`);
      assert.ok(focus.slice(Math.max(0, i - 140), i).includes('soundDetail &&'), `${notation} is drawn without the learner asking for it`);
    }
    // The wins name words, not symbols.
    assert.match(card, /heldSoundsLine\(/, 'the wins are still listed as symbols');
    assert.doesNotMatch(card, /w\.ipa\}\/`\)\.join/, 'the wins still spell IPA');
  });
});
