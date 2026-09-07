/**
 * The saved list, held to the promises `bookmarks/view.ts` makes.
 *
 * The store keeps decisions and this reads them back, so the cases that matter
 * are the ones where two decisions disagree, where the content moved under the
 * learner, and where there is nothing to show at all.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { DailyScenario } from '@luvani/core';
import type { BookmarkItem } from './store.ts';
import {
  SAVED_SITUATIONS_LABEL,
  SAVED_SITUATION_ACTION,
  bookmarkAccessibilityLabel,
  bookmarkLabel,
  bookmarkControl,
  bookmarkDecisions,
  hasSaved,
  isBookmarkedIn,
  savedSituations,
} from './view.ts';
import { guiltIn } from '../copy/guilt.ts';

const scenario = (id: string, titleEn = 'A seat on the terrace'): DailyScenario => ({
  id,
  titleEn,
  titleFr: 'Une place en terrasse',
  bodyEn: 'The terrace is full and you would rather sit outside.',
  openingFr: 'Bonjour, il y a une place en terrasse ?',
  openingEn: 'Hello, is there a seat on the terrace?',
  lines: [
    { fr: "Bonjour, on peut s'asseoir dehors ?", en: 'Hello, may we sit outside?' },
    { fr: 'Je peux attendre, ça ne me dérange pas.', en: 'I can wait, that is fine by me.' },
    { fr: 'Parfait, je prends celle-là. Merci !', en: 'Great, I will take that one. Thank you!' },
  ],
  theme: 'cafe-and-food',
  tier: 1,
  place: 'cafe',
});

const decision = (scenarioId: string, at: number, saved: boolean): BookmarkItem => ({ scenarioId, at, saved });

const POOL = [scenario('situation:a', 'A seat on the terrace'), scenario('situation:b', 'Asking for the bill')];

describe('the situations a learner saved to come back to — F394', () => {
  test('saved situations drop unknown ids, read newest first, and draw nothing when none is saved — F394', () => {
    // Nothing saved, and nothing to say about it.
    assert.deepEqual(savedSituations([], POOL), [], 'an empty store produced a saved situation from nowhere');
    assert.equal(hasSaved([]), false, 'My French would draw the saved card with nothing in it');
    assert.equal(
      hasSaved(savedSituations([decision('situation:a', 10, false)], POOL)),
      false,
      'a situation the learner un-saved still counts as saved',
    );

    // A decision is the latest one, in both directions.
    assert.equal(
      isBookmarkedIn(bookmarkDecisions([decision('situation:a', 10, true), decision('situation:a', 20, false)]), 'situation:a'),
      false,
      'the older save outranked the newer un-save, which is the bug the per-item store exists to prevent',
    );
    assert.equal(
      isBookmarkedIn(bookmarkDecisions([decision('situation:a', 20, false), decision('situation:a', 30, true)]), 'situation:a'),
      true,
      'a situation saved again after being un-saved did not come back',
    );
    assert.equal(
      isBookmarkedIn(bookmarkDecisions([decision('situation:a', 10, true)]), 'situation:b'),
      false,
      'a situation nobody decided about reads as saved',
    );

    // Order is the order a learner looks in: the last thing they saved, first.
    const twoSaves = [decision('situation:a', 10, true), decision('situation:b', 20, true)];
    assert.deepEqual(
      savedSituations(twoSaves, POOL).map((s) => s.id),
      ['situation:b', 'situation:a'],
      'the saved list is not newest first, so the thing they just saved is not where they will look',
    );

    // Content moved under the learner. The row goes; the screen does not.
    assert.deepEqual(
      savedSituations([decision('situation:retired', 10, true), decision('situation:a', 5, true)], POOL).map(
        (s) => s.id,
      ),
      ['situation:a'],
      'an id the pool no longer carries was not dropped, so a retired situation reaches a screen that cannot draw it',
    );
    assert.doesNotThrow(
      () => savedSituations([decision('situation:gone', 1, true)], POOL),
      'a bookmark for a situation this build does not have threw instead of being dropped',
    );

    // Every word this module can say.
    const lines = [
      SAVED_SITUATIONS_LABEL,
      SAVED_SITUATION_ACTION,
      bookmarkLabel(true),
      bookmarkLabel(false),
      bookmarkAccessibilityLabel(true, 'A seat on the terrace'),
      bookmarkAccessibilityLabel(false, 'A seat on the terrace'),
    ];
    for (const line of lines) {
      assert.ok(line.length > 0, 'a saved-list line is empty');
      assert.equal(guiltIn(line), undefined, `"${line}" says a word Luvani has promised not to say`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
    }
    assert.notEqual(bookmarkLabel(true), bookmarkLabel(false), 'the button says the same word in both states');
  });
});

/**
 * One fold, and a button that says what it is doing.
 *
 * Two bugs met in the same three lines on Home. Asking whether today's scene
 * was saved rebuilt the whole decision map twice per render, and the tap that
 * answered had no acknowledgement and no rejection path: between the tap and
 * two storage round-trips the word did not move, and a write that failed left
 * the learner tapping a button that would never change. Both are decisions
 * about a control, so both are decided here rather than inside a `.tsx`.
 */
describe('one fold of the decisions, shared, and a button that says what it is doing', () => {
  test('the fold is asked for once and answered many times', () => {
    const items = [
      decision('situation:a', 10, true),
      decision('situation:b', 20, true),
      decision('situation:a', 30, false),
    ];
    const decisions = bookmarkDecisions(items);
    // The same fold answers every question, which is the whole point of
    // handing it out: a reader with one Map does not build a second.
    assert.equal(isBookmarkedIn(decisions, 'situation:a'), false, 'the newer un-save lost to the older save');
    assert.equal(isBookmarkedIn(decisions, 'situation:b'), true, 'a saved situation reads as unsaved');
    assert.equal(isBookmarkedIn(decisions, 'situation:c'), false, 'a situation nobody decided about reads as saved');
    assert.equal(decisions.size, 2, 'the fold kept a row per decision rather than a row per situation');

    // And the saved list is the same fold, so the two readers cannot disagree
    // about what the learner chose.
    assert.deepEqual(
      savedSituations(items, POOL).map((s) => s.id),
      ['situation:b'],
      'the list and the per-situation answer disagree about the same decisions',
    );
  });

  test('the bookmark button says the write is running, and says when it did not take', () => {
    const title = 'A seat on the terrace';

    // At rest it says the state, as it always has.
    assert.equal(bookmarkControl(false, title, 'idle').label, 'Bookmark', 'the resting button lost its word');
    assert.equal(bookmarkControl(true, title, 'idle').label, 'Saved', 'a saved situation does not say so');
    assert.equal(bookmarkControl(false, title, 'idle').busy, false, 'a button with no write in flight is turned off');

    // While the write is in flight it moves, and it is turned off, so one tap
    // is one write rather than three.
    const saving = bookmarkControl(false, title, 'writing');
    assert.equal(saving.label, 'Saving', 'the button does not move while the store is being written and read back');
    assert.equal(saving.busy, true, 'a second tap can queue a second write over the first');
    assert.equal(bookmarkControl(true, title, 'writing').label, 'Removing', 'un-saving says it is saving, which is the opposite of what it is doing');

    // And a write that did not take says so, in the state the store is still
    // in. No apology, no blame, and the same button is the way to try again.
    const refused = bookmarkControl(false, title, 'refused');
    assert.equal(refused.label, 'Not saved yet', 'a write that failed leaves the button saying nothing happened');
    assert.equal(refused.busy, false, 'a write that failed leaves the button turned off, so there is no way to try again');
    assert.equal(bookmarkControl(true, title, 'refused').label, 'Still saved', 'a removal that failed claims the situation is gone from the list');

    // Everything the button can say is spoken as well as drawn, names the
    // situation it belongs to, and clears the whole copy bar.
    for (const saved of [false, true]) {
      for (const write of ['idle', 'writing', 'refused'] as const) {
        const control = bookmarkControl(saved, title, write);
        assert.ok(control.label.length > 0, `the button says nothing at all in ${write}`);
        assert.ok(
          control.accessibilityLabel.includes(title),
          `the button reads as a bare word to a screen reader in ${write}, naming no situation`,
        );
        for (const line of [control.label, control.accessibilityLabel]) {
          assert.equal(guiltIn(line), undefined, `"${line}" says a word Luvani has promised not to say`);
          assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
        }
      }
    }
    // The three states are three words, so a learner can tell them apart.
    const words = new Set(['idle', 'writing', 'refused'].map((w) => bookmarkControl(false, title, w as 'idle').label));
    assert.equal(words.size, 3, 'two of the three write states put the same word on the button');
  });
});
