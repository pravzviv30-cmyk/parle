/**
 * What Today says hello with — F387, F417, and the notebook redesign.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). The greeting used to rotate
 * through seven words on a timer; the design contract keeps only the orb and
 * the highlighter moving, so the rotation and its hook are retired and the
 * greeting is one still line: the hour's French word, then the first name,
 * then a full stop. "Bonsoir, Praveen." or "Bonsoir.", never a bare comma.
 *
 * Two things are still defended. The hour, because a language app that says
 * `Bonsoir` at breakfast is teaching something false. And the no-name line,
 * because the greeting is the first sentence the app says to a learner every
 * day, and an older version called them "you" or left a comma hanging.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as greetingModule from './greeting.ts';
import { greetingLine, greetingSubline, greetingWord, homeGreeting, localHour, GREETING_SUBLINES } from './greeting.ts';
import { BANNED_IN_COPY, guiltIn } from '../copy/guilt.ts';

/** A local timestamp on an ordinary Thursday, so the hour is the only variable. */
const at = (hour: number, minute = 0): number => new Date(2026, 0, 15, hour, minute, 0, 0).getTime();

describe('the greeting on Today', () => {
  test("the greeting is the hour's French word, still, with a name and a full stop — F417", () => {
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

    assert.equal(greetingLine('Praveen', at(21)), 'Bonsoir, Praveen.');
    assert.equal(greetingLine('Camille', at(9)), 'Bonjour, Camille.');

    // The header's two halves come from one call with one clock, so the word
    // and the question under it cannot describe two different parts of a day.
    assert.deepEqual(homeGreeting('Praveen', at(21)), { title: 'Bonsoir, Praveen.', subline: greetingSubline(at(21)) });
    assert.deepEqual(homeGreeting(null, at(9)), { title: 'Bonjour.', subline: greetingSubline(at(9)) });

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
    assert.equal(greetingLine(null, at(21)), 'Bonsoir.', 'a nameless learner is greeted with something other than the word and a full stop');
    assert.equal(greetingLine('   ', at(9)), 'Bonjour.', 'a name of nothing but spaces is greeted as if it were a name');
    // One name rule for the app: firstNameOf splits it.
    assert.equal(greetingLine('  Camille Dubois  ', at(9)), 'Bonjour, Camille.');

    const lines = [null, 'Camille', '  Camille Dubois  ', ''].flatMap((name) => [greetingLine(name, at(9)), greetingLine(name, at(21))]);
    assert.ok(BANNED_IN_COPY.length > 0);
    for (const line of lines) {
      assert.doesNotMatch(line, /,\s*$|,\.$|, \./, `"${line}" leaves a bare comma`);
      assert.match(line, /\.$/, `"${line}" does not end on a full stop`);
      assert.doesNotMatch(line, /\byou\b/i, `"${line}" calls the learner "you"`);
      assert.equal(guiltIn(line), undefined, `"${line}" says a banned word`);
      assert.doesNotMatch(line, /—|\d/, `"${line}" carries an em dash or a digit`);
    }
  });
});

/**
 * The line under the greeting — F571.
 *
 * Revamp A gives Home the one purpose line it never had, and it is a question
 * about the hour rather than a description of the screen. That makes it the
 * same class of thing as the greeting above it: "Ready to speak French
 * tonight?" at breakfast is `Bonsoir` at breakfast, one line further down. So
 * it is held to the same bar, at all twenty-four hours.
 */
describe('the line under the greeting — F571', () => {
  test('every hour has exactly one subline', () => {
    // The windows tile the clock: no hour with nothing to say, and no hour
    // where two lines are both true and the answer depends on the order of a
    // list. Midnight to five is the interesting one, because the evening's
    // window wraps and a comparison written the obvious way would empty it.
    for (let hour = 0; hour < 24; hour += 1) {
      const matching = GREETING_SUBLINES.filter(({ hours }) =>
        hours.from <= hours.to ? hour >= hours.from && hour < hours.to : hour >= hours.from || hour < hours.to,
      );
      assert.equal(
        matching.length,
        1,
        `${hour}:00 is true of ${matching.length} sublines, so the line under the greeting is a gap or a coin toss`,
      );
      assert.equal(greetingSubline(at(hour)), matching[0]!.line, `${hour}:00 does not draw the one subline that is true of it`);
    }

    // The three lines themselves, and the hours the founder's mockup names.
    assert.equal(greetingSubline(at(8)), 'Ready to speak French this morning?');
    assert.equal(greetingSubline(at(14)), 'Ready to speak French today?');
    assert.equal(greetingSubline(at(21)), 'Ready to speak French tonight?', 'the mockup reads tonight, and the evening is not saying it');
    assert.equal(greetingSubline(at(2)), 'Ready to speak French tonight?', 'the small hours have moved on to the morning');

    // The edges are the greeting's own, so the word and the question below it
    // can never describe two different parts of one day: Morning ends at noon,
    // and Bonsoir starts at six and wraps past midnight.
    assert.equal(greetingSubline(at(11, 59)), greetingSubline(at(8)), 'the morning ends before noon');
    assert.equal(greetingSubline(at(12)), greetingSubline(at(14)), 'midday is still the morning');
    assert.equal(greetingSubline(at(17, 59)), greetingSubline(at(14)), 'the day is over before six');
    assert.equal(greetingSubline(at(18)), greetingSubline(at(21)), 'the evening has not started at six');
    assert.equal(greetingSubline(at(4, 59)), greetingSubline(at(21)), 'the night ends before five');
    assert.equal(greetingSubline(at(5)), greetingSubline(at(8)), 'five in the morning is still the night before');

    // A clock nobody can read still asks a question, and it is the neutral one.
    assert.equal(greetingSubline(Number.NaN), 'Ready to speak French today?', 'an unreadable clock asks about a part of the day it cannot know');
  });

  test('no subline carries a digit or an em dash', () => {
    assert.equal(GREETING_SUBLINES.length, 3, 'there are no longer three parts of the day, so the sweep below is reading the wrong list');
    for (const { line } of GREETING_SUBLINES) {
      // The one line on Home that says what the screen is for counts nothing,
      // scores nothing and scolds nobody. It is also read aloud under a
      // greeting, so it is a plain question in plain words.
      assert.equal(guiltIn(line), undefined, `"${line}" says a word Luvani has banned from learner-facing copy`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash, which no learner-facing line may`);
      assert.doesNotMatch(line, /\d|%/, `"${line}" carries a number, and nothing on Home counts the learner`);
      assert.match(line, /\?$/, `"${line}" is not the question the founder's mockup asks`);
      assert.ok(line.startsWith('Ready to speak French'), `"${line}" does not open on the thing this app is for`);
    }
    // Three different endings, so the hour is actually doing something.
    assert.equal(new Set(GREETING_SUBLINES.map((subline) => subline.line)).size, 3, 'two parts of the day say the same line');
  });
});
