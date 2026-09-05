/**
 * What Home says hello with — F387.
 *
 * The rotation is the request: three words, in one order, on a clock measured
 * off the founder's mockup. None of that can be checked by looking at a
 * component, because apps/mobile has no renderer (docs/TESTING.md), so the
 * rule was pulled out into `greeting.ts` and this is where it is held.
 *
 * Two things are being defended. The timing, because "roughly three seconds"
 * is not what was asked for and a phase quietly changed is invisible in
 * review. And the no-name line, because the greeting is the first sentence the
 * app says to a learner every single day, and the version it replaces called
 * them "you".
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  GREETINGS,
  GREETING_HOLD_MS,
  GREETING_OUT_MS,
  GREETING_BLANK_MS,
  GREETING_IN_MS,
  GREETING_CYCLE_MS,
  greetingIndex,
  greetingLine,
  greetingRest,
} from './greeting.ts';
import { BANNED_IN_COPY, guiltIn } from '../copy/guilt.ts';

describe('the greeting on Home', () => {
  test('the greeting cycles Salut, Bonjour, Hello on a 3.75s clock and rests on Bonjour — F387', () => {
    assert.deepEqual(
      [...GREETINGS],
      ['Salut', 'Bonjour', 'Hello'],
      'the words, or their order, no longer match the mockup video the founder measured this against',
    );

    // The video says a word holds 2800ms, leaves over 250ms, is gone for 200ms
    // and returns over 500ms, and that switch to switch is 3750ms. Those are
    // five separate measurements, so they are allowed to disagree, and this is
    // the assertion that notices when they do.
    assert.equal(
      GREETING_HOLD_MS + GREETING_OUT_MS + GREETING_BLANK_MS + GREETING_IN_MS,
      GREETING_CYCLE_MS,
      'the four phases no longer add up to one switch, so the greeting drifts away from the video a little more every cycle',
    );

    // One word per cycle, in order, forever.
    assert.equal(greetingIndex(0, GREETINGS.length), 0, 'the header does not open on Salut');
    assert.equal(greetingIndex(GREETING_CYCLE_MS, GREETINGS.length), 1, 'the second cycle is not Bonjour');
    assert.equal(greetingIndex(GREETING_CYCLE_MS * 2, GREETINGS.length), 2, 'the third cycle is not Hello');
    assert.equal(
      greetingIndex(GREETING_CYCLE_MS * 3, GREETINGS.length),
      0,
      'the fourth cycle does not come back round to Salut, so the loop does not loop',
    );

    // Stable right up to the boundary: a word that changed early would be a
    // word that changed mid-fade, which is the one thing the eye catches.
    for (let cycle = 0; cycle < 6; cycle += 1) {
      const start = GREETING_CYCLE_MS * cycle;
      assert.equal(
        greetingIndex(start + GREETING_CYCLE_MS - 1, GREETINGS.length),
        greetingIndex(start, GREETINGS.length),
        `the word changes before cycle ${cycle} is over, so it changes while it is still on screen`,
      );
    }

    // Nothing about a strange clock reaches the header. A clock that has not
    // started, a device whose time moved backwards under us, and a pool of one
    // word all answer with the first word rather than with NaN or a throw.
    assert.equal(greetingIndex(0, 1), 0, 'a single-word pool does not answer at zero');
    assert.equal(greetingIndex(-9000, GREETINGS.length), 0, 'a clock that ran backwards is not treated as the start');
    assert.equal(
      greetingIndex(GREETING_CYCLE_MS * 41, 1),
      0,
      'a single-word pool divides by its own length and comes back with something other than the only word it has',
    );

    // The still version of the same greeting.
    assert.equal(greetingRest('Camille'), 'Bonjour, Camille', 'the resting greeting is no longer the Bonjour line');
    assert.equal(greetingRest(null), 'Bonjour', 'the resting greeting invents a name for a learner who gave none');
    assert.ok(
      GREETINGS.includes('Bonjour'),
      'the resting word is not one of the words that rotate, so reduce motion shows a greeting the moving header never does',
    );
  });

  test('a learner who skipped their name is greeted by the word alone — F387', () => {
    assert.equal(
      greetingLine('Salut', null),
      'Salut',
      'a learner who skipped the name question is greeted with something other than the bare word',
    );

    // The line this replaced was "Bonjour, you". Skipping the name question is
    // a choice, and the greeting has to look written that way rather than like
    // a hole with a placeholder in it.
    const lines = [
      ...GREETINGS.map((word) => greetingLine(word, null)),
      ...GREETINGS.map((word) => greetingLine(word, 'Camille')),
      greetingRest(null),
      greetingRest('Camille'),
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
    assert.equal(greetingLine('Hello', '   '), 'Hello', 'a name of nothing but spaces is greeted as if it were a name');

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
 * The rotation's failure mode, held to the source.
 *
 * There is no renderer here, so the hook is proven by reading it, and what is
 * being read for is one specific shape: whether the cycle can advance without an
 * animation frame. F416 shipped a version that could not. Each step hung off the
 * previous `Animated.timing`'s completion callback, so a browser freezing frames
 * for a hidden tab left the header at opacity 0 with no timer pending, holding a
 * word nobody could see. Timers throttle in the background; frames stop.
 */
describe('the greeting does not depend on a frame arriving — F416', () => {
  const hook = readFileSync(fileURLToPath(new URL('./useGreetingRotation.ts', import.meta.url)), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  test('the greeting survives a frame that never lands, and no exit leaves it invisible — F416', () => {
    // Nothing sequences off a completion callback: `start` is called for its
    // effect, never for its answer.
    assert.doesNotMatch(
      hook,
      /\.start\(\s*\(/,
      'a step of the cycle waits on an animation callback, so a frame that never lands stops the greeting',
    );
    assert.doesNotMatch(
      hook,
      /finished/,
      'the cycle still reads whether a fade finished, which is the frame dependency F416 removed',
    );

    // The sequence is timers, and every delay is one of the named constants.
    assert.match(hook, /after\(GREETING_HOLD_MS/, 'the hold is no longer a timer');
    assert.match(hook, /after\(GREETING_OUT_MS \+ GREETING_BLANK_MS/, 'the blank is no longer waited out on a timer');
    assert.match(hook, /after\(GREETING_IN_MS, cycle\)/, 'the cycle does not schedule its own next pass');

    // The fade still happens, and still on the native driver.
    assert.match(hook, /Animated\.timing/, 'the greeting stopped fading altogether');
    assert.match(hook, /useNativeDriver: true/, 'a timing left the native driver');

    // And every way out of the effect lands the word back at readable.
    const teardown = hook.slice(hook.lastIndexOf('return () =>'));
    assert.match(
      teardown,
      /opacity\.setValue\(1\)/,
      'the teardown stops the fade without restoring the word, so leaving mid-fade can leave it invisible',
    );
  });
});
