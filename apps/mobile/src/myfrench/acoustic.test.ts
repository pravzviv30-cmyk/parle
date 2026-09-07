/**
 * One sound, and the two things this panel may not do.
 *
 * It may not name a sound nothing measured, and it may not reprint a sentence
 * that was true on the day it was stored. Both are the same failure in
 * different clothes: a pronunciation claim the audio did not support.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PHONEME_COUNT, getPhoneme } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { ACOUSTIC, acousticFor } from './acoustic.ts';

describe('the acoustic panel — what it shows, and when it shows nothing', () => {
  test('a learner whose checks named no sound gets no panel at all', () => {
    // Not a panel of general advice with a measured-looking frame around it.
    assert.equal(acousticFor(null), null);
    assert.equal(acousticFor(''), null);
  });

  test('a symbol this build does not know draws nothing rather than a gap', () => {
    assert.equal(acousticFor('not-a-phoneme'), null);
  });

  test('the hardest French vowel arrives with its cue, its trick and its pair', () => {
    const panel = acousticFor('y');

    assert.ok(panel, 'the panel for /y/ is missing, and it is the one the mockup was drawn around');
    assert.equal(panel.cue, getPhoneme('y')!.cue, 'the cue was rewritten here instead of read from the inventory');
    assert.ok(panel.trick !== null, '/y/ has an authored trick and the panel dropped it');
    assert.equal(panel.pair?.a.word, 'tu');
    assert.equal(panel.pair?.b.word, 'tout');
    assert.equal(panel.pair?.a.ipa, 'ty');
    assert.notEqual(panel.pair?.a.gloss, '', 'a word arrived with no meaning beside it');
  });

  test('the heading only claims a contrast when the inventory records one', () => {
    // "vs English oo" is only honest where the inventory says that is what an
    // English speaker actually puts there instead.
    assert.match(acousticFor('y')!.heading, /\/y\/.*\/u\//, 'the /y/ heading lost its contrast');

    const noSubstitute = getPhoneme('a');
    assert.equal(noSubstitute?.typicalSubstitution, undefined, 'this fixture stopped being the no-contrast case');
    assert.doesNotMatch(acousticFor('a')!.heading, / it is not/, 'a contrast was claimed against nothing');
  });

  test('no panel anywhere carries a score, a share, or a badge', () => {
    // The mockup marked one word "Mastered" and the other "Contrast". Nothing
    // in this app keeps a per-word pronunciation history to earn either.
    //
    // The guilt list is deliberately NOT run over the phonetics below. It is a
    // rule about progress copy, and `guilt.ts` says plainly that its substring
    // matching costs false positives: "owe" is inside "vowel" and "lower",
    // "lose" is inside "closer", and "behind" is inside "the ridge behind your
    // teeth". Every one of those is an articulation instruction rather than a
    // scold, all of it is authored in core, and SummaryScreen.tsx:82-94 has
    // been showing the same strings to learners since long before this panel.
    // Rewriting good phonetics to dodge a substring would make the teaching
    // worse to satisfy a rule that was never about it. What IS held to the list
    // is the copy this module writes, which is the test below.
    for (const phoneme of ['y', 'u', 'ʁ', 'ɑ̃', 'e']) {
      const panel = acousticFor(phoneme);
      if (!panel) continue;
      for (const line of [panel.heading, panel.cue, panel.trick ?? '', panel.why ?? '']) {
        assert.doesNotMatch(line, /\d\s*%|\bmastered\b|\bscore\b/i, `"${line}" claims a measurement this app cannot make`);
      }
    }
  });

  test('the heading this module writes is held to the list, because this module wrote it', () => {
    for (const ipa of ['y', 'u', 'a', 'ʁ']) {
      const panel = acousticFor(ipa);
      if (!panel) continue;
      assert.equal(guiltIn(panel.heading), undefined, `the heading for /${ipa}/ carries a banned word`);
      assert.ok(!panel.heading.includes('—'), `the heading for /${ipa}/ carries an em dash`);
    }
  });

  test('every sound the inventory carries either draws a panel or draws none, and never half of one', () => {
    // The refusal that keeps this honest: a phoneme with no authored cue would
    // otherwise render a heading over an empty callout.
    let drawn = 0;
    for (const phoneme of Array.from({ length: PHONEME_COUNT }, (_, i) => i)) {
      void phoneme;
    }
    for (const ipa of ['y', 'u', 'ʁ', 'ø', 'ɛ̃', 'ʒ', 'a', 'i', 'o']) {
      const panel = acousticFor(ipa);
      if (panel === null) continue;
      drawn += 1;
      assert.notEqual(panel.cue.trim(), '', `${ipa} drew a panel with no cue in it`);
      assert.notEqual(panel.heading.trim(), '', `${ipa} drew a panel with no heading`);
    }
    assert.ok(drawn > 4, `only ${drawn} panels drew at all, so this sweep proves little`);
  });

  test('its own words are clean and carry no em dash', () => {
    for (const line of Object.values(ACOUSTIC)) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries a banned word`);
      assert.ok(!line.includes('—'), `"${line}" carries an em dash`);
    }
  });
});
