/**
 * Today counts today, and forgets it.
 *
 * The last test in this file is the one that matters. It is not really about
 * strings: it is the thing standing between a small honest daily count and the
 * streak PRODUCT.md has now rejected twice. If somebody later adds "day 4" or
 * "don't lose it", this fails and says why.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { todayFrom, hasToday, SITTINGS_IN_A_DAY } from './today.ts';
import { guiltIn } from '../copy/guilt.ts';
import type { ActivityEntry } from './activity.ts';

/** A local-time moment, so the day boundary under test is the learner's. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const entry = (when: number, kind: ActivityEntry['kind'] = 'convo'): ActivityEntry => ({
  at: when,
  kind,
  xp: 10,
});

const NOON = at(2026, 8, 20, 12);

describe('what counts', () => {
  test('nothing today is absent, not a zero', () => {
    const today = todayFrom([], NOON);
    assert.equal(today.done, 0);
    assert.equal(hasToday(today), false, 'Home must render nothing rather than an empty pair of marks');
    assert.equal(today.headline, '');
    assert.equal(today.sub, '');
  });

  test('one sitting reads as one, and invites a second without demanding it', () => {
    const today = todayFrom([entry(at(2026, 8, 20, 9))], NOON);
    assert.equal(today.done, 1);
    assert.ok(hasToday(today));
    assert.match(today.sub, /if you want it/);
  });

  test('two is the shape, and says so without congratulating a number', () => {
    const today = todayFrom([entry(at(2026, 8, 20, 8)), entry(at(2026, 8, 20, 19))], NOON);
    assert.equal(today.done, SITTINGS_IN_A_DAY);
    assert.equal(today.headline, 'Twice today.');
  });

  test('more than two is still fine, and is never scolded for it', () => {
    const many = [8, 12, 15, 20].map((h) => entry(at(2026, 8, 20, h)));
    const today = todayFrom(many, NOON);
    assert.equal(today.done, 4);
    assert.ok(hasToday(today));
  });

  test('a silent sitting counts exactly as much as a spoken one', () => {
    // Every spoken path has a quiet twin, so a drill and a conversation are
    // worth the same mark. A learner who cannot speak aloud right now is not
    // having a lesser day.
    const typed = todayFrom([entry(at(2026, 8, 20, 9), 'drill')], NOON);
    const spoken = todayFrom([entry(at(2026, 8, 20, 9), 'convo')], NOON);
    assert.equal(typed.done, spoken.done);
    assert.equal(typed.headline, spoken.headline);
  });
});

describe('the day boundary is the learner\'s own', () => {
  test('yesterday is not read', () => {
    const yesterday = [entry(at(2026, 8, 19, 10)), entry(at(2026, 8, 19, 20))];
    assert.equal(todayFrom(yesterday, NOON).done, 0, 'yesterday leaked into today');
  });

  test('tomorrow is not read either', () => {
    assert.equal(todayFrom([entry(at(2026, 8, 21, 1))], NOON).done, 0);
  });

  test('23:59 and 00:01 are different days', () => {
    const late = entry(at(2026, 8, 20, 23, 59));
    const early = entry(at(2026, 8, 21, 0, 1));
    assert.equal(todayFrom([late, early], at(2026, 8, 20, 23, 59)).done, 1);
    assert.equal(todayFrom([late, early], at(2026, 8, 21, 0, 1)).done, 1);
  });

  test('a long history costs nothing and leaks nothing', () => {
    const history: ActivityEntry[] = [];
    for (let d = 1; d <= 19; d += 1) history.push(entry(at(2026, 8, d, 10)));
    history.push(entry(at(2026, 8, 20, 10)));
    assert.equal(todayFrom(history, NOON).done, 1, 'nineteen previous days must not be visible from today');
  });
});

describe('it cannot become a streak', () => {
  const CASES = [0, 1, 2, 5].map((n) =>
    todayFrom(
      Array.from({ length: n }, (_, i) => entry(at(2026, 8, 20, 8 + i))),
      NOON,
    ),
  );

  test('no copy contains a digit', () => {
    // DESIGN.md's rule is that no mid-session message contains a number, and
    // Home is not mid-session, so this is stricter than it has to be. It is
    // here because "day 3" is how a count becomes a chain.
    for (const c of CASES) {
      assert.doesNotMatch(c.headline + ' ' + c.sub, /\d/, `"${c.headline} ${c.sub}" carries a number`);
    }
  });

  test('no copy threatens, scolds, or asks the learner to protect anything', () => {
    // The eleven words that used to sit here now live in copy/guilt.ts, with
    // the mix offer's four folded in, because three private lists meant the
    // shortest of them was the real rule (F216). Same matching as before,
    // substring rather than word boundary, plus `owe` which Home never had.
    for (const c of CASES) {
      const copy = `${c.headline} ${c.sub}`;
      const word = guiltIn(copy);
      assert.equal(word, undefined, `"${copy.trim()}" contains "${word}"`);
    }
  });

  test('no copy contains an em dash', () => {
    for (const c of CASES) {
      assert.doesNotMatch(c.headline + c.sub, /—/);
    }
  });

  test('the zero case has no words at all, which is the whole defence', () => {
    const empty = todayFrom([], NOON);
    assert.equal(`${empty.headline}${empty.sub}`, '');
  });
});
