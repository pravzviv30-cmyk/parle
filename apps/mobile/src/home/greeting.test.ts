/**
 * What Home says hello with — F387, F416 and F417.
 *
 * The rotation is the request: a wide pool of words, in one order, on a clock
 * measured off the founder's mockup, and every one of them true for the hour a
 * learner is reading it. None of that can be checked by looking at a component,
 * because apps/mobile has no renderer (docs/TESTING.md), so the rule was pulled
 * out into `greeting.ts` and this is where it is held.
 *
 * Three things are being defended. The hour, because a language app that says
 * `Bonsoir` at breakfast is teaching something false and the mistake is one
 * wrong comparison wide. The timing, because "roughly three seconds" is not
 * what was asked for and a phase quietly changed is invisible in review. And
 * the no-name line, because the greeting is the first sentence the app says to
 * a learner every single day, and the version it replaces called them "you".
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  GREETINGS,
  GREETING_CYCLE_MS,
  GREETING_HOLD_MS,
  GREETING_SWIPE_MS,
  GREETING_WIDEST_WORD,
  greetingIndex,
  greetingLead,
  greetingLine,
  greetingPool,
  greetingRest,
  greetingSubline,
  localHour,
  GREETING_SUBLINES,
} from './greeting.ts';
import { BANNED_IN_COPY, guiltIn } from '../copy/guilt.ts';

/** A local timestamp on an ordinary Thursday, so the hour is the only variable. */
const at = (hour: number, minute = 0): number => new Date(2026, 0, 15, hour, minute, 0, 0).getTime();

/** The words a learner could meet at this hour, in the order the header plays them. */
const wordsAt = (hour: number, minute = 0): string[] => greetingPool(at(hour, minute)).map((g) => g.word);

describe('the greeting on Home', () => {
  test("the greeting pool is wide, time-appropriate, and rests on the hour's French word — F417", () => {
    // Seven words, not three. French and English interleaved, because the
    // learner is greeted in the language they came for and met in their own.
    assert.deepEqual(
      GREETINGS.map((greeting) => greeting.word),
      ['Salut', 'Bonjour', 'Hello', 'Coucou', 'Morning', 'Bonsoir', 'Evening'],
      'the words, or their order, no longer match the pool the founder asked for',
    );

    // The band used to be load-bearing: the header sized a fixed slot by the
    // widest word, so a longer one would have had its tail clipped. F427 ended
    // that, because the fixed slot is what left a hole after `Salut,`. The
    // header hugs the words in flow now and nothing can be clipped, so this is a
    // sanity bound on the content rather than a rule the layout depends on: a
    // one-letter greeting or a sentence would both draw, and neither belongs on
    // a display line beside somebody's name.
    assert.ok(
      GREETINGS.every((greeting) => greeting.word.length >= 5 && greeting.word.length <= 7),
      'a greeting left the five to seven letter band, which is the shape a display line beside a name holds',
    );
    for (const { word } of GREETINGS) {
      assert.ok(word.length >= 5, `"${word}" is shorter than five characters and leaves a hole in the header's slot`);
      assert.ok(
        word.length <= GREETING_WIDEST_WORD.length,
        `"${word}" is wider than "${GREETING_WIDEST_WORD}", which sizes the slot, so the header would clip its tail`,
      );
    }
    assert.ok(
      GREETINGS.some((greeting) => greeting.word === GREETING_WIDEST_WORD),
      'the word that sizes the slot is not one of the words the pool can produce',
    );

    // The hour, read from the timestamp and never from a clock inside the rule.
    assert.equal(localHour(at(8)), 8, 'the local hour of a morning timestamp is not the morning');
    assert.equal(localHour(at(20, 45)), 20, 'the minutes move the hour');

    // Morning: no evening word can reach a learner at breakfast.
    const morning = wordsAt(8);
    for (const evening of ['Bonsoir', 'Evening']) {
      assert.ok(!morning.includes(evening), `"${evening}" is offered at 08:00, which teaches a learner the wrong time of day`);
    }
    assert.deepEqual(morning, ['Salut', 'Bonjour', 'Hello', 'Coucou', 'Morning'], 'the eight o clock pool is not the morning pool');

    // Evening: no daytime word after six.
    const evening = wordsAt(20);
    for (const daytime of ['Bonjour', 'Morning']) {
      assert.ok(!evening.includes(daytime), `"${daytime}" is offered at 20:00, hours after anyone in France would say it`);
    }
    assert.deepEqual(evening, ['Salut', 'Hello', 'Coucou', 'Bonsoir', 'Evening'], 'the eight in the evening pool is not the evening pool');

    // Two in the morning is still the evening's window. The window wraps around
    // midnight, and a comparison written the obvious way would empty it.
    assert.deepEqual(wordsAt(2), evening, 'the small hours do not carry the evening pool, so the window does not wrap past midnight');

    // The two edges of the day, either side of five and either side of six.
    assert.deepEqual(wordsAt(4, 59), evening, 'at 04:59 the greeting has already moved on to the day');
    assert.deepEqual(wordsAt(5, 0), morning, 'at 05:00 the greeting is still in the night before');
    assert.deepEqual(wordsAt(18, 0), evening, 'at 18:00 the evening has not started');

    // Morning the English word is narrower than Bonjour the French one: it
    // stops at noon, and the afternoon is Bonjour without it, right up to six.
    const afternoon = ['Salut', 'Bonjour', 'Hello', 'Coucou'];
    assert.ok(wordsAt(11, 59).includes('Morning'), 'the morning word has gone before noon');
    assert.deepEqual(wordsAt(12), afternoon, 'midday is not the afternoon pool, so the app still says Morning after noon');
    assert.deepEqual(wordsAt(17, 59), afternoon, 'at 17:59 the day is over early');

    // Every hour of the day has words to say and exactly one to rest on, and
    // the resting word is always the French one. A still header is still a
    // header that has to be right about the time of day.
    for (let hour = 0; hour < 24; hour += 1) {
      const pool = greetingPool(at(hour));
      assert.ok(pool.length >= 3, `${hour}:00 offers ${pool.length} greetings, which is not a rotation`);
      const resting = pool.filter((greeting) => greeting.rest === true);
      assert.equal(
        resting.length,
        1,
        `${hour}:00 rests on ${resting.length} words, and a still header can only show one`,
      );
      const word = resting[0]!.word;
      assert.ok(['Bonjour', 'Bonsoir'].includes(word), `${hour}:00 rests on "${word}", which is not the hour's French word`);
      assert.equal(greetingRest('Camille', at(hour)), `${word}, Camille`, `the still greeting at ${hour}:00 is not the hour's resting word`);
      assert.equal(
        greetingRest(null, at(hour)),
        `${word},`,
        `the still greeting at ${hour}:00 invents a name for a learner who gave none, or drops the comma that leans into the hour's question`,
      );
    }

    // The two phases the founder measured off the video, and the switch to
    // switch they have to add up to. Three separate measurements, so they are
    // allowed to disagree, and this is the assertion that notices when they do.
    assert.equal(
      GREETING_HOLD_MS + GREETING_SWIPE_MS,
      GREETING_CYCLE_MS,
      'the two phases no longer add up to one switch, so the greeting drifts away from the video a little more every cycle',
    );

    // One word per cycle, in order, forever, over whatever the hour offers.
    const count = morning.length;
    assert.equal(greetingIndex(0, count), 0, 'the header does not open on the first word of the hour');
    assert.equal(greetingIndex(GREETING_CYCLE_MS, count), 1, 'the second cycle is not the second word');
    assert.equal(greetingIndex(GREETING_CYCLE_MS * count, count), 0, 'the loop does not come back round, so it does not loop');
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const start = GREETING_CYCLE_MS * cycle;
      assert.equal(
        greetingIndex(start + GREETING_CYCLE_MS - 1, count),
        greetingIndex(start, count),
        `the word changes before cycle ${cycle} is over, so it changes while it is still on screen`,
      );
    }

    // Nothing about a strange clock reaches the header. A clock that has not
    // started, a device whose time moved backwards under us, and a pool of one
    // word all answer with the first word rather than with NaN or a throw.
    assert.equal(greetingIndex(0, 1), 0, 'a single-word pool does not answer at zero');
    assert.equal(greetingIndex(-9000, count), 0, 'a clock that ran backwards is not treated as the start');
    assert.equal(
      greetingIndex(GREETING_CYCLE_MS * 41, 1),
      0,
      'a single-word pool divides by its own length and comes back with something other than the only word it has',
    );
    // A clock nobody can read still greets somebody, and never with a word it
    // cannot stand behind. Midday is the safer wrong answer: Bonjour is
    // ordinary at almost any waking hour and Bonsoir at breakfast is not.
    assert.equal(localHour(Number.NaN), 12, 'an unreadable clock is not treated as the middle of the day');
    assert.equal(localHour(1e20), 12, 'a timestamp past the end of time is not treated as the middle of the day');
    assert.equal(greetingRest('Camille', Number.NaN), 'Bonjour, Camille', 'an unreadable clock rests on something other than Bonjour');
    assert.equal(greetingRest(null, Number.NaN), 'Bonjour,', 'an unreadable clock greets a nameless learner with something other than Bonjour');
    assert.deepEqual(
      greetingPool(1e20).map((greeting) => greeting.word),
      afternoon,
      'a timestamp no date can hold offers a mixed pool, so a learner could be told good evening at breakfast',
    );
  });

  test('a learner who skipped their name is greeted by the word alone — F387', () => {
    // The founder's mockup reads `Bonsoir,` and then the hour's question, so
    // the comma is there whether or not we know a name: it leans into the line
    // below rather than into a name we may not have. What a learner who skipped
    // the question never gets is a placeholder standing in for one.
    assert.equal(
      greetingLine('Salut', null),
      'Salut,',
      'a learner who skipped the name question is greeted with something other than the word and its comma',
    );
    // The comma belongs to the word, not to the header, so it travels with the
    // word through the slot. A learner with no name gets no dangling comma.
    assert.equal(greetingLead('Salut'), 'Salut,', 'the moving word does not carry the comma that joins it to a name');
    assert.equal(greetingLead('Coucou'), 'Coucou,', 'the comma is decided by something other than the word it belongs to');

    // The line this replaced was "Bonjour, you". Skipping the name question is
    // a choice, and the greeting has to look written that way rather than like
    // a hole with a placeholder in it. Every word of the pool, both ways round,
    // at both ends of the day.
    const words = GREETINGS.map((greeting) => greeting.word);
    const lines = [
      ...words.map((word) => greetingLine(word, null)),
      ...words.map((word) => greetingLine(word, 'Camille')),
      ...words.map((word) => greetingLead(word)),
      greetingRest(null, at(9)),
      greetingRest('Camille', at(9)),
      greetingRest(null, at(21)),
      greetingRest('Camille', at(21)),
    ];
    for (const line of lines) {
      assert.doesNotMatch(line, /\byou\b/i, `"${line}" calls the learner "you", which is how Home used to sound like it had forgotten them`);
    }

    // One name rule for the whole app: the splitting is firstNameOf's, so a
    // padded full name behaves here exactly as it does on the tutor dashboard.
    assert.equal(
      greetingLine('Bonjour', '  Camille Dubois  '),
      'Bonjour, Camille',
      'a full name with whitespace around it is not reduced to the first name the way the tutor dashboard reduces it',
    );
    assert.equal(greetingLine('Hello', '   '), 'Hello,', 'a name of nothing but spaces is greeted as if it were a name');

    // The house copy rules, run rather than eyeballed. The ban list is
    // substring matched and catches ordinary words (break, lose, owe), so the
    // only honest way to know a greeting is clean is to put it through the
    // matcher every other copy suite uses.
    assert.ok(BANNED_IN_COPY.length > 0, 'the ban list is empty, so the loop below is asserting nothing');
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `"${line}" says a word Luvani has banned from learner-facing copy`);
      assert.doesNotMatch(line, /—/, `"${line}" carries an em dash, which no learner-facing line may`);
      assert.doesNotMatch(line, /\d/, `"${line}" carries a digit, and the greeting counts nothing`);
    }
  });
});

/**
 * The rotation's handoff, held to the source.
 *
 * There is no renderer here, so the hook is proven by reading it. The native
 * animation owns the usual commit so a JS timer cannot replace the
 * pair before its final frame. A watchdog remains for a suspended surface that
 * never reports completion, and the commit is idempotent so the two paths cannot
 * advance twice. The progress reset happens in a layout effect after the new
 * pair commits, preventing a one-frame flash of the outgoing greeting.
 */
describe('the greeting does not depend on a frame arriving — F416, F419', () => {
  const hook = readFileSync(fileURLToPath(new URL('./useGreetingRotation.ts', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  test('the greeting commits on the final frame, survives suspension and resets after layout — F416', () => {
    // The normal path commits from the native animation's completion.
    assert.match(hook, /run\.start\(\(\{ finished \}\) => \{/);
    assert.match(hook, /if \(finished\) commit\(\)/);

    // The word holds on a timer and a slightly-late watchdog covers a surface
    // whose frame callback never returns.
    assert.match(hook, /after\(GREETING_HOLD_MS/, 'the hold is no longer a timer');
    assert.match(hook, /after\(GREETING_SWIPE_MS \+ 120, commit\)/, 'a suspended surface has no guarded way to advance');
    assert.match(hook, /if \(!live \|\| committed\) return/, 'completion and watchdog can advance the greeting twice');

    // The swipe is eased and stays on the native driver.
    assert.match(hook, /Animated\.timing/, 'the greeting stopped moving altogether');
    assert.match(hook, /easing: Easing\.inOut\(Easing\.cubic\)/, 'the word still moves with the timing default rather than a deliberate eased handoff');
    assert.match(hook, /useNativeDriver: true/, 'a timing left the native driver');

    // React commits the arriving word first; only its layout effect resets the
    // strip. Resetting in `commit` would flash the old current word.
    assert.match(hook, /useLayoutEffect\(\(\) => \{\s*progress\.setValue\(0\);\s*\}, \[index, progress\]\)/);
    const commit = hook.slice(hook.indexOf('const commit ='), hook.indexOf('const run ='));
    assert.doesNotMatch(commit, /progress\.setValue\(0\)/, 'the callback restores the outgoing word before React commits the arriving one');

    // And every way out of the effect lands the slot back at rest, showing a
    // whole word. Stopping an animation leaves the value where it stood, and
    // where it stood may be half a line up.
    const teardown = hook.slice(hook.lastIndexOf('return () =>'));
    assert.match(
      teardown,
      /progress\.setValue\(0\)/,
      'the teardown stops the swipe without returning the slot to rest, so leaving mid-swipe can leave a word half gone',
    );
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
