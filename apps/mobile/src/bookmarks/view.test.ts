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
  hasSaved,
  isBookmarked,
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
      isBookmarked([decision('situation:a', 10, true), decision('situation:a', 20, false)], 'situation:a'),
      false,
      'the older save outranked the newer un-save, which is the bug the per-item store exists to prevent',
    );
    assert.equal(
      isBookmarked([decision('situation:a', 20, false), decision('situation:a', 30, true)], 'situation:a'),
      true,
      'a situation saved again after being un-saved did not come back',
    );
    assert.equal(
      isBookmarked([decision('situation:a', 10, true)], 'situation:b'),
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
