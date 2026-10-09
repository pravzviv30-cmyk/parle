/**
 * When the voice circle is allowed to move.
 *
 * The rule was two conditions inside a `useEffect`, and the third reason to
 * hold still went missing for exactly as long as it was written there: a bottom
 * tab stays mounted after its first visit, so one trip to Tutor left two
 * native-driver loops breathing behind Home, Practice and Profile for the rest
 * of the session. That is the same class of miss `live/thinking.ts` was pulled
 * out of a switch to prevent, so the question moved here where it can be asked.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { orbRests } from './orbRest.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

const ORB = stripComments(read('./VoiceOrb.tsx'));
const ORB_FLAT = flat(ORB);
/** The drawing itself, which is the half of the orb that never moves. */
const GLYPH = stripComments(read('./OrbGlyph.tsx'));
const GLYPH_FLAT = flat(GLYPH);

/** A breathing state: the ready circle on the tutor card. */
const BREATHING = { amplitude: 0.04, shimmer: false } as const;
/** The thinking state, which dims instead of moving. */
const SHIMMERING = { amplitude: 0, shimmer: true } as const;
/** The error state, which neither moves nor dims. */
const STOPPED = { amplitude: 0, shimmer: false } as const;

describe('the voice circle rests when nobody is looking at it', () => {
  test('a circle on a tab that is not on top holds its final frame', () => {
    assert.equal(
      orbRests({ ...BREATHING, reduced: false, paused: true }),
      true,
      'the circle breathes on behind a tab the learner left, which is two native loops running for the rest of the session',
    );
    assert.equal(
      orbRests({ ...SHIMMERING, reduced: false, paused: true }),
      true,
      'the thinking circle keeps dimming behind a tab nobody is looking at',
    );
    // And it moves again when the tab comes back, so pausing is a pause and
    // not a retirement.
    assert.equal(
      orbRests({ ...BREATHING, reduced: false, paused: false }),
      false,
      'the circle stays still on the tab the learner is actually looking at',
    );
  });

  test('reduce motion and a state with nothing to animate rest for their own reasons', () => {
    assert.equal(
      orbRests({ ...BREATHING, reduced: true, paused: false }),
      true,
      'a learner who asked for less movement is shown a breathing circle anyway',
    );
    assert.equal(
      orbRests({ ...STOPPED, reduced: false, paused: false }),
      true,
      'a state with no amplitude and no shimmer runs a loop that moves nothing',
    );
    // The one that is easy to get backwards: no amplitude is not the same as
    // nothing to do, because the thinking circle dims rather than moves.
    assert.equal(
      orbRests({ ...SHIMMERING, reduced: false, paused: false }),
      false,
      'the thinking circle is held still, so a learner waiting on the tutor sees a dead orb',
    );
  });

  test('any one reason is enough, and no reason means it moves', () => {
    // Four reasons, read as one answer: a circle that moved because only three
    // of them said so is the bug this module exists to make impossible.
    for (const reduced of [false, true]) {
      for (const paused of [false, true]) {
        for (const look of [BREATHING, SHIMMERING, STOPPED]) {
          const still = orbRests({ ...look, reduced, paused });
          const anyReason = paused || reduced || (look.amplitude === 0 && !look.shimmer);
          assert.equal(
            still,
            anyReason,
            `a circle with paused=${paused}, reduced=${reduced} and amplitude ${look.amplitude} answered ${still}`,
          );
        }
      }
    }
  });
});

/**
 * The wiring, read as source, because there is no renderer in this workspace
 * (docs/TESTING.md). The ceiling is honest: this proves the component asks this
 * module and cleans up after its own timer, never that a phone stopped drawing.
 */
describe('the voice circle asks this module rather than deciding again', () => {
  test('the orb takes a paused prop, keys its effect on it, and rests through orbRests', () => {
    assert.match(
      ORB_FLAT,
      /import \{ orbRests \} from '\.\/orbRest\.ts'/,
      'the orb decides for itself when to hold still, so the rule has two answers again',
    );
    assert.match(
      ORB_FLAT,
      /paused\?: boolean/,
      'the orb cannot be told the screen it sits on is no longer the one on top',
    );
    assert.match(
      ORB_FLAT,
      /paused = false/,
      'paused has no default, so every existing caller of the orb has to be changed to keep working',
    );
    assert.match(
      ORB_FLAT,
      /orbRests\(\{[^}]*paused[^}]*\}\)/,
      'the orb works out whether to move without passing the pause in, which is the loop that never stops',
    );
    assert.match(
      ORB_FLAT,
      /\}, \[state, reduced, paused\]\)/,
      'the effect does not watch the pause, so a tab left behind keeps the loop it started',
    );
  });

  test('the orb clears the timer that staggers its second driver', () => {
    // useSceneMotion.ts:166-177 keeps both the guard and the handle, and says
    // why: a scene unmounted inside the delay window would otherwise start a
    // loop that nothing owns. The orb had the guard alone.
    assert.match(ORB_FLAT, /timers\.push\( setTimeout\(/, 'the stagger timer handle is thrown away the moment it is made');
    assert.match(ORB_FLAT, /for \(const t of timers\) clearTimeout\(t\);/, 'the stagger timer is never cleared on teardown');
    assert.match(ORB_FLAT, /if \(cancelled\) return;/, 'the guard inside the delay window went when the handle arrived; both matter');
  });

  test('the orb carries no empty style entry', () => {
    // An entry with nothing in it is a name a reader has to look up to learn
    // that it says nothing, and StyleSheet.create is not free.
    assert.doesNotMatch(ORB, /^\s*\w+: \{\},$/m, 'the orb defines a style rule with nothing in it');
  });
});

/** 9 October: the requested cloud surface supersedes the old flat glyph. */
describe('the cloud orb preserves native lifecycle and a clear surface', () => {
  test('the cloud is decorative, bounded and independent of the audio session', () => {
    const surface = stripComments(read('./OrbSurface.tsx'));
    assert.match(surface, /\{\.\.\.decorative\}/);
    assert.match(surface, /<ClipPath/);
    assert.match(surface, /<FeGaussianBlur/);
    assert.match(surface, /useId/);
    assert.doesNotMatch(surface, /useEffect|setInterval|fetch\(|Audio|LiveKit|Image/);
    assert.match(ORB_FLAT, /<OrbSurface color=\{look\.colour\} size=\{size\} \/>/);
    assert.doesNotMatch(ORB_FLAT, /<MicGlyph|look\.mark|st\.signal|BAR_HEIGHTS\.map/);
    for (const timing of ORB.match(/Animated\.timing\([\s\S]*?\}\)/g) ?? []) {
      assert.match(timing, /useNativeDriver: NATIVE_DRIVER/);
    }
    const from = ORB_FLAT.indexOf('if (orbRests(');
    assert.notEqual(from, -1);
    const rest = ORB_FLAT.slice(from, ORB_FLAT.indexOf('return; }', from) + 'return; }'.length);
    assert.match(rest, /driver\.setValue\(0\.5\)/);
    assert.match(rest, /dim\.setValue\(1\)/);
    assert.doesNotMatch(rest, /\.start\(\)/);
  });
  test('voice bars require real output bands and sit with the status below the surface', () => {
    assert.match(ORB_FLAT, /layers\.bars === 'live' && audio !== null/);
    assert.match(ORB_FLAT, /<LiveBars bands=\{audio\.bands\}/);
    assert.match(ORB_FLAT, /<View style=\{st\.status\}>/);
    assert.match(ORB_FLAT, /embeddedLabel \?\? \(layers\.caption === 'hearing' \? HEARING_YOU : look\.caption\)/);
    assert.match(ORB_FLAT, /const active = useAppActive\(\)/);
    assert.match(ORB_FLAT, /paused: props\.paused === true \|\| !active/);
  });
});
