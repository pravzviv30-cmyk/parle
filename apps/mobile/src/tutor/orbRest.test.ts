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

/**
 * The redraw — F588.
 *
 * The founder saw the outline rings and the lit sphere side by side and picked
 * the sphere, so the orb is a gradient ball inside three faint rings now, with
 * the voice lines either side while somebody is talking. The two halves are
 * split on purpose: `OrbGlyph.tsx` is the drawing and holds every attribute
 * still, `VoiceOrb.tsx` is the movement and touches nothing but transform and
 * opacity. That split is what keeps the whole thing on the native driver, and
 * it is the thing most easily lost in a redraw, so it is read back here.
 */
describe('the orb is one gradient ball, drawn still and moved by transform alone — F588', () => {
  test('the orb rests as one still gradient with its rings and lines drawn once when motion is reduced', () => {
    // The drawing: one Svg, the gradient built from the ONE state colour thinned
    // by opacity, three faint rings at the shared stroke, six voice lines.
    assert.equal((GLYPH.match(/<Svg\b/g) ?? []).length, 1, 'the orb is drawn as more than one Svg, so its layers can drift apart');
    assert.match(GLYPH_FLAT, /<Svg[^>]*\{\.\.\.decorative\}/, 'the orb is announced to a screen reader as an unlabelled image');
    assert.match(GLYPH_FLAT, /<RadialGradient id=\{id\} cx="50%" cy="42%" r="55%">/, 'the orb lost the radial gradient the founder chose');
    for (const stop of ['stopOpacity={1}', 'stopOpacity={0.85}', 'stopOpacity={0.45}']) {
      assert.ok(GLYPH_FLAT.includes(stop), `the gradient no longer thins the one colour at ${stop}`);
    }
    assert.equal(
      (GLYPH.match(/stopColor=\{color\}/g) ?? []).length,
      3,
      'a stop is set in something other than the state colour, which is a palette hex the theme never shipped',
    );
    for (const ring of ['strokeOpacity={0.18}', 'strokeOpacity={0.12}', 'strokeOpacity={0.07}']) {
      assert.ok(GLYPH_FLAT.includes(ring), `the orb lost the faint ring at ${ring}`);
    }
    assert.equal((GLYPH.match(/strokeWidth=\{STROKE\}/g) ?? []).length, 4, 'a ring or a voice line is drawn at a weight the app does not own');
    assert.equal((GLYPH.match(/<Path\b/g) ?? []).length, 6, 'the orb draws a number of voice lines other than three either side');
    assert.match(GLYPH_FLAT, /const id = `orb\$\{useId\(\)/, 'two orbs on one page would share a gradient id, and two gradients under one id is one gradient');

    // The drawing never moves itself: an Animated attribute on an Svg is the
    // one way back onto the JS thread, and this is the file it would appear in.
    for (const moving of ['Animated', 'interpolate', 'useEffect']) {
      assert.ok(!GLYPH.includes(moving), `the orb's drawing reaches for ${moving}; the drawing holds still and the wrapper moves it`);
    }

    // The wrapper: the ball is the glyph now, not two bordered Views, and the
    // only things that move are a scale and a scaleY on the native driver.
    assert.match(ORB_FLAT, /<OrbGlyph color=\{look\.colour\} size=\{size\} \/>/, 'the orb no longer draws itself through the one glyph');
    assert.match(ORB_FLAT, /transform: \[\{ scale: breath \}\]/, 'the ball no longer breathes by transform');
    assert.match(ORB_FLAT, /transform: \[\{ scaleY: stretch \}\]/, 'the voice lines no longer stretch by transform');
    assert.ok(!/borderWidth/.test(ORB), 'the orb is drawn as bordered Views again instead of as the glyph');
    for (const timing of ORB.match(/Animated\.timing\([\s\S]*?\}\)/g) ?? []) {
      assert.match(timing, /useNativeDriver: true/, `an orb animation runs on the JS thread: ${flat(timing)}`);
    }

    // And the rest frame is still one frame: every driver parked in the middle,
    // the dimming undone, and nothing started. A learner who asked for less
    // movement sees the whole drawing, rings and lines included, standing still.
    const from = ORB_FLAT.indexOf('if (orbRests(');
    assert.notEqual(from, -1, 'the orb no longer asks whether to rest; this test is reading the wrong thing');
    const rest = ORB_FLAT.slice(from, ORB_FLAT.indexOf('return; }', from) + 'return; }'.length);
    assert.match(rest, /for \(const d of drivers\) d\.setValue\(0\.5\);/, 'the rest frame leaves a driver wherever it stopped');
    assert.match(rest, /dim\.setValue\(1\);/, 'the rest frame leaves the orb part way through a dim');
    assert.ok(!rest.includes('.start()'), 'the rest branch starts an animation before it returns');
  });

  test('the voice lines are drawn wherever the orb has a voice, and move only where one is speaking', () => {
    // The founder's Tutor tab draws the lines beside the untapped circle, and
    // the app drew a bare disc: `waves` was one boolean, so "there is a voice in
    // the room" and "the lines exist at all" were the same question, and hiding
    // the lines until a conversation started took the shape out of the one
    // control on the screen.
    //
    // They are two questions now, and the table is read back state by state
    // rather than sampled, because the interesting half of this is the states
    // that draw them WITHOUT moving them.
    const look = (state: string): string => {
      const from = ORB.indexOf(`  ${state}: {`);
      assert.notEqual(from, -1, `the LOOKS table no longer has a ${state} state`);
      const setting = /waves: '(\w+)'/.exec(ORB.slice(from, ORB.indexOf('\n  },', from)));
      assert.ok(setting, `${state} no longer says whether its voice lines are drawn`);
      return setting![1]!;
    };
    assert.equal(look('ready'), 'still', 'the untapped circle has no lines beside it, so it is a bare disc and not the thing the founder drew');
    assert.equal(look('idle'), 'still', 'the resting circle has no lines beside it');
    assert.equal(look('speaking'), 'moving', 'the tutor speaks and the lines stand still');
    assert.equal(look('listening'), 'moving', 'the learner speaks and the lines stand still');
    // Thinking dims the whole orb rather than moving anything, and error is the
    // orb saying nothing at all. A line either side of either would be a voice
    // in a room where there is not one.
    assert.equal(look('thinking'), 'none', 'the thinking circle grew lines, which claims a voice while nobody is talking');
    assert.equal(look('error'), 'none', 'the stopped circle grew lines');

    // Drawn on the three-way, not on a boolean: `look.waves ? …` would draw them
    // for 'none' as well, because every non-empty string is truthy, which is
    // exactly the bug this split could introduce.
    assert.match(ORB_FLAT, /\{look\.waves !== 'none' \? \(/, 'the lines are drawn on a truthiness test, so the thinking orb would grow a pair');

    // And the cost stays where it was. The second driver is what makes the
    // lines move, and it runs for 'moving' alone; a still pair is a picture.
    assert.match(
      ORB_FLAT,
      /const moving = look\.waves === 'moving' \? drivers : drivers\.slice\(0, 1\);/,
      'the second driver runs for a state whose lines do not move, which is a native loop drawing nothing',
    );
    // A driver starts at 0 and the stretch reads 1 - WAVE_TRAVEL there, so an
    // unstarted pair would sit permanently squashed. Parked at the middle, the
    // stretch is exactly 1 and the lines stand at their full height.
    assert.match(
      ORB_FLAT,
      /if \(look\.waves !== 'moving'\) drivers\[1\]!\.setValue\(0\.5\);/,
      'lines that are drawn but not moving are left wherever their driver started, which is part way through a squash',
    );
  });

  test('the tutor is drawn as the orb and never as a face or the learner\'s initial', () => {
    const mark = stripComments(read('./TutorMark.tsx'));
    assert.match(mark, /<OrbGlyph color=\{orb\.ready\} size=\{DISC - 8\} \/>/, 'the tutor mark is no longer the orb at the size of a row disc');
    assert.match(mark, /\{\.\.\.decorative\}/, 'the tutor mark is announced beside the words that already name the tutor');
    assert.ok(!/Monogram/.test(mark), "the tutor wears the learner's initial, which says the tutor is the learner");
    assert.ok(!/face|eye|smile/i.test(mark), 'the tutor has grown a face, which the founder settled against');
  });
});
