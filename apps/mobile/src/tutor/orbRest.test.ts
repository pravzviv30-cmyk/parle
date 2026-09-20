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
 * The UI 4 evolution: mist rather than gloss, and the voice mark directly in
 * the colour field rather than inside a capsule.
 */
describe('the orb is a still watercolour field with directly animated voice bars', () => {
  test('the still glyph uses one state colour for two mist washes and three quiet rings', () => {
    assert.equal((GLYPH.match(/<Svg\b/g) ?? []).length, 1, 'the orb is drawn as more than one Svg, so its layers can drift apart');
    assert.match(GLYPH_FLAT, /<Svg[^>]*\{\.\.\.decorative\}/, 'the orb is announced to a screen reader as an unlabelled image');
    assert.equal((GLYPH.match(/<RadialGradient\b/g) ?? []).length, 2, 'the watercolour field lost one of its offset washes');
    assert.equal((GLYPH.match(/stopColor=\{color\}/g) ?? []).length, 6, 'a mist stop uses a colour outside the current state');
    for (const ring of ['strokeOpacity={0.05}', 'strokeOpacity={0.08}', 'strokeOpacity={0.13}']) {
      assert.ok(GLYPH_FLAT.includes(ring), `the orb lost the quiet ring at ${ring}`);
    }
    assert.equal((GLYPH.match(/strokeWidth=\{STROKE\}/g) ?? []).length, 3, 'one ring is drawn with a different pen');
    assert.match(GLYPH_FLAT, /const token = useId\(\)/, 'two orbs on one page can share gradient ids');

    for (const moving of ['Animated', 'interpolate', 'useEffect']) {
      assert.ok(!GLYPH.includes(moving), `the orb's SVG reaches for ${moving}; the wrapper owns every moving part`);
    }

    assert.match(ORB_FLAT, /<OrbGlyph color=\{look\.colour\} size=\{size\} \/>/, 'the orb no longer draws itself through the one glyph');
    assert.match(ORB_FLAT, /transform: \[\{ scale: breath \}\]/, 'the mist no longer breathes by transform');
    assert.ok(!/MicGlyph|controlGlass|borderWidth/.test(ORB), 'a microphone or frosted inner capsule returned to the minimalist orb');
    for (const timing of ORB.match(/Animated\.timing\([\s\S]*?\}\)/g) ?? []) {
      assert.match(timing, /useNativeDriver: true/, `an orb animation runs on the JS thread: ${flat(timing)}`);
    }

    const from = ORB_FLAT.indexOf('if (orbRests(');
    assert.notEqual(from, -1, 'the orb no longer asks whether to rest; this test is reading the wrong thing');
    const rest = ORB_FLAT.slice(from, ORB_FLAT.indexOf('return; }', from) + 'return; }'.length);
    assert.match(rest, /for \(const driver of drivers\) driver\.setValue\(0\.5\);/, 'the rest frame leaves a driver wherever it stopped');
    assert.match(rest, /dim\.setValue\(1\);/, 'the rest frame leaves the orb part way through a dim');
    assert.ok(!rest.includes('.start()'), 'the rest branch starts an animation before it returns');
  });

  test('seven white bars sit directly in every orb and move only in active voice states', () => {
    const signal = /signal: \{([^}]+)\}/.exec(ORB_FLAT)?.[1];
    assert.ok(signal, 'the waveform has its own centred overlay');
    assert.ok(!/padding|translate[XY]|margin/.test(signal), 'fixed offsets must not displace the waveform at compact sizes');
    for (const circle of GLYPH.match(/<Circle[^>]+>/g) ?? []) {
      assert.match(circle, /cx=\{CENTRE\} cy=\{CENTRE\}/, 'every visible orb layer must share the waveform centre');
    }
    assert.match(GLYPH_FLAT, /r=\{75\} fill=\{paper\.ground\}/, 'the paper collar separates the voice surface from chartreuse');
    assert.match(ORB_FLAT, /const BAR_HEIGHTS = \[0\.1, 0\.17, 0\.27, 0\.38, 0\.27, 0\.17, 0\.1\] as const/, 'the central voice mark is no longer the seven-bar form');
    assert.match(ORB_FLAT, /\{BAR_HEIGHTS\.map\(\(height, index\) => \(/, 'the direct voice mark is not drawn inside the orb');
    assert.match(ORB_FLAT, /bar: \{ backgroundColor: paper\.onInk \}/, 'the voice bars are not the direct white mark from UI 4');
    assert.match(ORB_FLAT, /embeddedLabel !== undefined \? <Text style=\{st\.embeddedLabel\}>\{embeddedLabel\}<\/Text> : null/, 'the landing status is not embedded directly under the bars');

    const look = (state: string): string => {
      const from = ORB.indexOf(`  ${state}: {`);
      assert.notEqual(from, -1, `the LOOKS table no longer has a ${state} state`);
      const setting = /bars: '(\w+)'/.exec(ORB.slice(from, ORB.indexOf('\n  },', from)));
      assert.ok(setting, `${state} no longer says whether its bars move`);
      return setting![1]!;
    };
    for (const state of ['ready', 'idle', 'thinking', 'error']) assert.equal(look(state), 'still', `${state} animates a voice that is not talking`);
    for (const state of ['connecting', 'speaking', 'listening']) assert.equal(look(state), 'moving', `${state} gives no responsive movement`);
    assert.match(ORB_FLAT, /const moving = look\.bars === 'moving' \? drivers : drivers\.slice\(0, 1\);/, 'the waveform driver runs in resting states');
    assert.match(ORB_FLAT, /if \(look\.bars !== 'moving'\) drivers\[1\]!\.setValue\(0\.5\);/, 'still bars are parked part-way through a pulse');
  });

  test('the tutor is drawn as the orb and never as a face or the learner\'s initial', () => {
    const mark = stripComments(read('./TutorMark.tsx'));
    assert.match(mark, /<OrbGlyph color=\{orb\.ready\} size=\{DISC - 8\} \/>/, 'the tutor mark is no longer the orb at the size of a row disc');
    assert.match(mark, /\{\.\.\.decorative\}/, 'the tutor mark is announced beside the words that already name the tutor');
    assert.ok(!/Monogram/.test(mark), "the tutor wears the learner's initial, which says the tutor is the learner");
    assert.ok(!/face|eye|smile/i.test(mark), 'the tutor has grown a face, which the founder settled against');
  });
});
