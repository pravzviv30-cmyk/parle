/**
 * The end of a conversation says how it went, and never marks it — F584.
 *
 * The line this replaces was `{turns} turns · {percent}% on your own`, rendered
 * straight onto the recap. It is the only percentage the app has ever shown a
 * learner, and it sat on the screen somebody reaches at the moment they are
 * most likely to decide whether they are any good at this.
 *
 * Two questions here, and the second is the one that keeps it closed. The
 * function is run over the whole range, and then the recap screen itself is
 * read as text, because there is no renderer in this suite (docs/TESTING.md)
 * and "the screen no longer prints a percentage" is a fact about a file.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HELD_ON_THEIR_OWN, HELD_WITH_HELP, MOSTLY_UNAIDED, recapLine } from './recapLine.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const stats = (unassistedRate: number) => ({ turns: 6, rescues: 2, unassistedRate });

describe('the end of a conversation, said in words — F584', () => {
  test('the recap says how it went in words, never a percentage', () => {
    // The line itself: two sentences, and both of them are about what the
    // learner did rather than about how much of it was right.
    assert.equal(recapLine(stats(1)), HELD_ON_THEIR_OWN, 'a conversation held alone is not said so');
    assert.equal(recapLine(stats(MOSTLY_UNAIDED)), HELD_ON_THEIR_OWN, 'the threshold itself falls the wrong way');
    assert.equal(recapLine(stats(0.2)), HELD_WITH_HELP, 'a conversation with help is not said so');
    // Zero unaided turns still describes six measured learner turns with help;
    // it is different from a session with no learner turn at all.
    assert.equal(recapLine(stats(0)), HELD_WITH_HELP, 'measured turns with help must retain their existing copy');

    // Neither line carries a digit, a percent sign or a count, at any input.
    for (let rate = 0; rate <= 1.0001; rate += 0.05) {
      const line = recapLine(stats(rate));
      assert.ok(
        line === HELD_ON_THEIR_OWN || line === HELD_WITH_HELP,
        `the recap invented a third sentence at ${rate}: ${line}`,
      );
      assert.doesNotMatch(line, /\d|%/, `the recap line carries a number: ${line}`);
    }

    // And the screen draws that line rather than working the arithmetic out
    // again. The exact expression it used is named, so it cannot come back by
    // being retyped slightly differently.
    const screen = stripComments(read('../RecapScreen.tsx'));
    // F903/F904: the line comes through sessionCredit, which calls recapLine with the scene's total replies.
    assert.match(screen, /const credit = sessionCredit\(recap\.stats, carriedReplies\);/, 'the recap screen no longer says how it went at all');
    assert.match(screen, /\{credit\.line\}/, 'the recap screen no longer says how it went at all');
    assert.doesNotMatch(screen, /unassistedRate/, 'the recap screen reads the rate itself, which is how the percentage came back');
    assert.doesNotMatch(screen, /stats\.turns/, 'the recap screen counts the turns at the learner again');
    assert.ok(!screen.includes('%'), 'a percent sign is back on the one screen that must never carry one');
  });

  test('a recap with no learner turns acknowledges time without claiming a conversation', () => {
    for (const unassistedRate of [0, MOSTLY_UNAIDED, 1, Number.NaN]) {
      const line = recapLine({ turns: 0, rescues: 0, unassistedRate });
      assert.equal(line, 'You made time for your French.', 'a rate cannot invent learner participation');
      assert.doesNotMatch(line, /\d|%|held the conversation/, 'the empty-session line must not score or invent a conversation');
    }
  });

  test('invalid learner turn counts cannot earn conversation claims while positive counts retain their copy', () => {
    for (const turns of [-1, -Infinity, Infinity, Number.NaN, 0.5]) {
      assert.equal(recapLine({ turns, rescues: 0, unassistedRate: 1 }), 'You made time for your French.');
    }
    for (const turns of [1, 6, 40]) {
      assert.equal(recapLine({ turns, rescues: 2, unassistedRate: MOSTLY_UNAIDED }), HELD_ON_THEIR_OWN);
      assert.equal(recapLine({ turns, rescues: 2, unassistedRate: 0 }), HELD_WITH_HELP);
    }
  });
});
