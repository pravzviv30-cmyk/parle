/**
 * The daily pools, held to the words Luvani has promised not to say.
 *
 * `packages/core/src/daily/` carries the word of the day and the situation of
 * the day, and its own suite already checks their shape: unique ids, no em
 * dash, no digit, and short enough to ride the seed topic pipe. What it cannot
 * check is the ban list, because `copy/guilt.ts` lives in `apps/mobile` and a
 * core test that imported it would invert the workspace dependency direction.
 * Copying the list into core would give the rule two homes and let the shorter
 * one become the real one, which is the exact failure `copy/guilt.ts` was
 * written to end.
 *
 * So the check lives on this side of the boundary, where the list is, and reads
 * the pools across it. That is the same arrangement `progress/story.ts` explains
 * for learner-facing progress copy, and the reason is the same one.
 *
 * The pools are 127 words and 71 situations of authored French and English, and
 * every one of them reaches a learner on Home. `guiltIn` matches by substring
 * and catches ordinary words on purpose, so this is a check somebody has to
 * pass rather than a formality: it is what stops a warm sentence about not
 * breaking bread, or a market stall that sells flowers, reaching the card.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_SCENARIOS, DAILY_WORDS } from '@luvani/core';
import { guiltIn } from './guilt.ts';

describe('the daily pools speak the way Luvani promised — F389', () => {
  test('no daily word or situation says a word Luvani has banned — F389', () => {
    for (const word of DAILY_WORDS) {
      // The French is content and the ban list is an English one, so only the
      // lines written to be read as Luvani's own voice are checked: the meaning
      // and the note. `fr` and `exampleFr` are French and are checked by core.
      for (const [field, line] of [
        ['en', word.en],
        ['note', word.note],
        ['exampleEn', word.exampleEn],
      ] as const) {
        const banned = guiltIn(line);
        assert.equal(banned, undefined, `${word.id}'s ${field} says "${banned}", which Luvani does not say`);
      }
    }

    for (const situation of DAILY_SCENARIOS) {
      for (const [field, line] of [
        ['titleEn', situation.titleEn],
        ['bodyEn', situation.bodyEn],
        ['openingEn', situation.openingEn],
      ] as const) {
        const banned = guiltIn(line);
        assert.equal(
          banned,
          undefined,
          `${situation.id}'s ${field} says "${banned}", which Luvani does not say`,
        );
      }
    }

    // The pools are the point of the check, so an empty one would pass it
    // silently. This is what noticed when a barrel export went missing.
    assert.ok(DAILY_WORDS.length >= 90, 'the word pool is smaller than a day for every word promised');
    assert.ok(DAILY_SCENARIOS.length >= 60, 'the situation pool is smaller than a day for every situation promised');
  });
});
