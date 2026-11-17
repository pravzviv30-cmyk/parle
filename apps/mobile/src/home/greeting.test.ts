/**
 * What Today says hello with — F387, F417, and the notebook redesign.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). The greeting used to rotate
 * through seven words on a timer; the design contract keeps only the orb and
 * the highlighter moving, so the rotation and its hook are retired and the
 * greeting is one still line: the hour's French word, then the first name,
 * with no full stop (founder, 2026-11-06). "Bonsoir, Praveen" or "Bonsoir",
 * never a bare comma.
 *
 * Two things are still defended. The hour, because a language app that says
 * `Bonsoir` at breakfast is teaching something false. And the no-name line,
 * because the greeting is the first sentence the app says to a learner every
 * day, and an older version called them "you" or left a comma hanging.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as greetingModule from './greeting.ts';
import { greetingWord, homeGreeting, localHour } from './greeting.ts';
import { BANNED_IN_COPY, guiltIn } from '../copy/guilt.ts';

/** A local timestamp on an ordinary Thursday, so the hour is the only variable. */
const at = (hour: number, minute = 0): number => new Date(2026, 0, 15, hour, minute, 0, 0).getTime();

describe('the greeting on Today', () => {
  test("the greeting is the hour's French word, still, with a name and no full stop — F417", () => {
    assert.equal(localHour(at(8)), 8);
    assert.equal(localHour(at(20, 45)), 20);

    // Bonjour through the day, Bonsoir from six and past midnight.
    assert.equal(greetingWord(at(8)), 'Bonjour');
    assert.equal(greetingWord(at(17, 59)), 'Bonjour', 'the evening starts before six');
    assert.equal(greetingWord(at(18)), 'Bonsoir', 'the evening has not started at six');
    assert.equal(greetingWord(at(2)), 'Bonsoir', 'the small hours are not the evening, so the window does not wrap');
    assert.equal(greetingWord(at(4, 59)), 'Bonsoir');
    assert.equal(greetingWord(at(5)), 'Bonjour');
    for (let hour = 0; hour < 24; hour += 1) {
      assert.ok(['Bonjour', 'Bonsoir'].includes(greetingWord(at(hour))), `${hour}:00 greets with something other than the hour's French word`);
    }
    // A clock nobody can read lands on Bonjour, the safer wrong answer.
    assert.equal(localHour(Number.NaN), 12);
    assert.equal(localHour(1e20), 12);
    assert.equal(greetingWord(Number.NaN), 'Bonjour');

    assert.equal(homeGreeting('Praveen', at(21)).title, 'Bonsoir, Praveen');
    assert.equal(homeGreeting('Camille', at(9)).title, 'Bonjour, Camille');

    // UI-015 (founder 2026-10-30): direction A's sky brings back the hour's
    // word on Today, superseding B's one word all day. Two lines on screen,
    // the word with its comma and then the name; one title for the reader.
    assert.deepEqual(homeGreeting('Praveen', at(9)), { word: 'Bonjour', name: 'Praveen', title: 'Bonjour, Praveen' });
    assert.deepEqual(homeGreeting('  Camille Dubois  ', at(9)), { word: 'Bonjour', name: 'Camille', title: 'Bonjour, Camille' });
    assert.deepEqual(homeGreeting(null, at(9)), { word: 'Bonjour', name: null, title: 'Bonjour' });
    assert.deepEqual(homeGreeting('   ', at(21)), { word: 'Bonsoir', name: null, title: 'Bonsoir' });
    assert.equal(homeGreeting('Praveen', at(18)).word, 'Bonsoir');
    assert.equal(homeGreeting('Praveen', at(4, 59)).title, 'Bonsoir, Praveen');
    assert.equal(homeGreeting('Praveen', at(5)).word, 'Bonjour');
    assert.equal(homeGreeting('Praveen', at(17, 59)).word, 'Bonjour');
    assert.equal(homeGreeting('Praveen', Number.NaN).word, 'Bonjour', 'an unreadable clock lands on midday');

    // The rotation is gone: no pool, no cycle, no timer numbers, and no hook.
    for (const retired of ['GREETINGS', 'GREETING_CYCLE_MS', 'GREETING_HOLD_MS', 'GREETING_SWIPE_MS', 'greetingIndex', 'greetingLead', 'greetingPool', 'greetingRest']) {
      assert.ok(!(retired in greetingModule), `greeting.ts still exports ${retired}, which only the retired rotation read`);
    }
    assert.ok(
      !existsSync(fileURLToPath(new URL('./useGreetingRotation.ts', import.meta.url))),
      'the rotation hook still ships, and nothing may move on Today but the orb and the highlighter',
    );
  });

  test('a learner who skipped their name is greeted by the word alone, with no bare comma — F387', () => {
    assert.equal(homeGreeting(null, at(21)).title, 'Bonsoir', 'a nameless learner is greeted with something other than the word alone');
    assert.equal(homeGreeting('   ', at(9)).title, 'Bonjour', 'a name of nothing but spaces is greeted as if it were a name');
    // One name rule for the app: firstNameOf splits it.
    assert.equal(homeGreeting('  Camille Dubois  ', at(9)).title, 'Bonjour, Camille');

    const lines = [null, 'Camille', '  Camille Dubois  ', ''].flatMap((name) => [homeGreeting(name, at(9)).title, homeGreeting(name, at(21)).title]);
    assert.ok(BANNED_IN_COPY.length > 0);
    for (const name of [null, 'Camille']) {
      assert.doesNotMatch(homeGreeting(name, at(9)).title, /\.$/, 'the title ends on a full stop');
      assert.doesNotMatch(homeGreeting(name, at(21)).title, /\.$/, 'the title ends on a full stop');
    }
    for (const line of lines) {
      assert.doesNotMatch(line, /,\s*$|,\.$|, \./, `"${line}" leaves a bare comma`);
      assert.doesNotMatch(line, /\.$/, `"${line}" ends on a full stop`);
      assert.doesNotMatch(line, /\byou\b/i, `"${line}" calls the learner "you"`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a banned word`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a digit`);
    }
  });
});

/**
 * F998: the line under the greeting left the screen with revamp A's sky, so
 * its rule and its three questions went too (no production caller).
 */
describe('the greeting stands alone', () => {
  test('the greeting has no subline', () => {
    for (const retired of ['greetingSubline', 'GREETING_SUBLINES']) {
      assert.ok(!(retired in greetingModule), `greeting.ts still exports ${retired}, which nothing draws`);
    }
    assert.doesNotMatch(readFileSync(fileURLToPath(new URL('./SkyBand.tsx', import.meta.url)), 'utf8'), /subline/i, 'the sky draws a line under the greeting');
  });
});
