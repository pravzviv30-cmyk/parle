/**
 * The motion primitives keep their common contract (come alive section 3).
 *
 * Every primitive takes reduced motion from motion.ts and lands on its final
 * frame, stops when the app leaves the foreground or it unmounts, and keeps
 * whatever is decorative away from assistive technology and from touches.
 * motion.test.ts holds the engine rules for every file; this suite holds the
 * promises particular to the primitives.
 *
 * Read as text and never imported: these files load Reanimated, which a Node
 * suite cannot (motion.test.ts, rule 7). A tripwire rather than a proof, as
 * motion.test.ts says of itself, because apps/mobile has no renderer.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = (name: string): string => fileURLToPath(new URL(`./${name}`, import.meta.url));

/** The source without comments, which may say anything. */
function code(name: string): string {
  assert.ok(existsSync(path(name)), `motion/${name} is missing`);
  return readFileSync(path(name), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** Every primitive, by file, and what it exports. */
const PRIMITIVES: Record<string, string[]> = {
  'StaggerIn.tsx': ['StaggerIn'],
  'CountUp.tsx': ['CountUp'],
  'ProgressRing.tsx': ['ProgressRing'],
  'ProgressRing.web.tsx': ['ProgressRing'],
  'LivingBar.tsx': ['LivingBar'],
  'Burst.tsx': ['Burst'],
  'DiscBloom.tsx': ['DiscBloom'],
  'TokenFlight.tsx': ['useTokenFlight', 'FlightToken'],
  'FlightLayer.tsx': ['FlightLayer'],
  'Glint.tsx': ['Glint'],
  'MorphButton.tsx': ['MorphButton'],
  'layout.tsx': ['Enter', 'Reflow', 'Exit'],
  'BubbleIn.tsx': ['BubbleIn'],
  'LevelRing.tsx': ['LevelRing'],
};

/** The primitives that land through the part they are built on, rather than themselves. */
const LANDS_THROUGH: Record<string, { file: string; use: RegExp }> = {
  'StaggerIn.tsx': { file: 'layout.tsx', use: /<Enter\b/ },
  'BubbleIn.tsx': { file: 'layout.tsx', use: /<Enter\b/ },
  'ProgressRing.tsx': { file: 'useRingDraw.ts', use: /\buseRingDraw\(/ },
  'ProgressRing.web.tsx': { file: 'useRingDraw.ts', use: /\buseRingDraw\(/ },
  // A flying token is drawn by the layer, which lands everything in the air.
  'TokenFlight.tsx': { file: 'FlightLayer.tsx', use: /\bflights\.land\(/ },
};

/**
 * The primitives whose reduced-motion answer is wholly the part they are built
 * on. Asking again would be a second answer, and the two can land a commit
 * apart: a cascade that started with every child at index 0 never staggers.
 */
const ANSWERED_BY: Record<string, string> = { 'StaggerIn.tsx': 'layout.tsx', 'BubbleIn.tsx': 'layout.tsx' };

/** The primitives that draw nothing a learner reads: hidden, and every touch passes through. */
const DECORATIVE = ['Burst.tsx', 'DiscBloom.tsx', 'Glint.tsx', 'LevelRing.tsx', 'FlightLayer.tsx', 'TokenFlight.tsx', 'ProgressRing.tsx', 'ProgressRing.web.tsx'];

describe('the motion primitives keep one contract', () => {
  test('every primitive is here, reads reduced motion from motion.ts, and stops when the app leaves', () => {
    for (const [file, names] of Object.entries(PRIMITIVES)) {
      const body = code(file);
      for (const name of names) {
        assert.match(body, new RegExp(`export function ${name}\\b`), `motion/${file} no longer exports ${name}`);
      }
      // Read here, or wholly in the part it is built on.
      const answeredBy = ANSWERED_BY[file];
      const reads = answeredBy === undefined ? body : code(answeredBy);
      assert.match(reads, /\buseReduceMotion\(/, `motion/${file} does not read reduced motion live`);
      assert.match(
        reads,
        /import \{[^}]*\buseReduceMotion\b[^}]*\} from '\.\.\/motion\.ts';/,
        `motion/${file} reads a reduced-motion answer that is not motion.ts's`,
      );
      // Leaving the foreground lands everything, in the primitive or in the part it is built on.
      const landsThrough = LANDS_THROUGH[file];
      if (landsThrough === undefined) {
        assert.match(body, /\buseLandOnLeave\(|\bAppState\.addEventListener\(/, `motion/${file} keeps moving when the app leaves the foreground`);
      } else {
        assert.match(body, landsThrough.use, `motion/${file} is no longer built on ${landsThrough.file}`);
        assert.match(code(landsThrough.file), /\buseLandOnLeave\(/, `motion/${landsThrough.file} keeps moving when the app leaves the foreground`);
      }
    }

    const landing = code('landing.ts');
    assert.match(landing, /AppState\.addEventListener\('change', \(state\) => \{\s*if \(state !== 'active'\) latest\.current\(\);/, 'useLandOnLeave no longer lands when the app leaves active');
    assert.match(landing, /return \(\) => \{\s*subscription\.remove\(\);\s*guard\.unmounted\(\(\) => latest\.current\(\)\);/, 'useLandOnLeave no longer lands on unmount');
    assert.match(landing, /setTimeout\(\(\) => setLate\(true\), ANSWER_WAIT_MS\)/, 'a one-shot waits on the OS for ever rather than playing the reduced version');
    assert.match(landing, /return late \? true : null;/, 'a one-shot that heard no answer does not play the reduced version');
  });

  test('the decorative primitives hide from assistive technology and let every touch through', () => {
    for (const file of DECORATIVE) {
      const body = code(file);
      assert.match(body, /\{\.\.\.decorative\}/, `motion/${file} is announced to a screen reader`);
      assert.match(body, /pointerEvents="none"/, `motion/${file} can catch a touch meant for what is under it`);
      assert.doesNotMatch(body, /\b(?:onPress|onTouchStart|onResponder\w*)=/, `motion/${file} handles touches`);
    }
    // Confetti and the glow are flat: palette colours, no gradient, no shadow.
    for (const file of ['Burst.tsx', 'DiscBloom.tsx', 'Glint.tsx']) {
      assert.doesNotMatch(code(file), /Gradient|shadow|elevation/i, `motion/${file} paints a gradient or a shadow`);
    }
  });

  test('reduced motion lands every one-shot on its final frame', () => {
    // Confetti and a glint are only movement, so their final frame is nothing.
    assert.match(code('Burst.tsx'), /if \(!live \|\| reduced !== false \|\| pieces\.length === 0\) return null;/, 'confetti draws under reduced motion');
    assert.match(code('Glint.tsx'), /if \(reduced\) land\(\);/, 'a glint passes under reduced motion');
    // An entrance is simply there.
    assert.match(code('layout.tsx'), /if \(reduced\) \{\s*cancel\(shown\);\s*shown\.value = 1;\s*return;\s*\}/, 'an entrance under reduced motion is not at rest at once');
    // A count shows its final value.
    assert.match(code('CountUp.tsx'), /if \(reduced\) \{\s*land\(\);\s*return;\s*\}/, 'a count under reduced motion does not show its final value at once');
    // The ring and the bar are drawn where they end, and still say they arrived.
    assert.match(code('useRingDraw.ts'), /if \(reduced\) \{[\s\S]*?drawn\.value = goal;[\s\S]*?answer\.current = setTimeout\(settle, 0\);/, 'the ring under reduced motion is not drawn at once, or never says it is done');
    assert.match(code('LivingBar.tsx'), /if \(reduced\) \{\s*still\(\);[\s\S]*?setTimeout\(settle, 0\);/, 'the bar under reduced motion is not full at once, or never says it filled');
    // A held glow stays; a passing one is gone.
    assert.match(code('DiscBloom.tsx'), /if \(reduced === null \|\| \(reduced && !hold\)\) return null;/, 'a passing glow draws under reduced motion');
    // The waiting pill keeps its shape and swaps its words.
    assert.match(code('MorphButton.tsx'), /const closed = !calm && \(now === 'busy' \|\| now === 'done'\);/, 'the pill changes shape under reduced motion');
    assert.match(code('MorphButton.tsx'), /reduced \? \(state === 'busy' \? busyLabel : state === 'done' \? doneLabel : label\) : label/, 'the pill does not swap its words under reduced motion');
    // A token under reduced motion lands at once, and so does everything in the air when it is turned on.
    assert.match(code('TokenFlight.tsx'), /if \(still\.current \|\| !flights\.canFly\(\)\) \{\s*onLand\(\);\s*return;\s*\}/, 'a token flies under reduced motion, or waits when it cannot fly');
    assert.match(code('FlightLayer.tsx'), /if \(reduced\) flights\.landAll\(\);/, 'tokens in the air keep flying when reduced motion is turned on');
    // The level ring keeps no scale, only steps.
    assert.match(code('LevelRing.tsx'), /if \(reduced\) \{\s*const step = LEVEL_RING\.steps\.find/, 'the level ring scales under reduced motion');
  });

  test('a count says only its final value to a screen reader, keeps its width and ticks by the rules', () => {
    const body = code('CountUp.tsx');
    assert.match(body, /<View accessible accessibilityLabel=\{label \?\? last\}/, 'a count does not announce its final value');
    assert.match(body, /<View \{\.\.\.decorative\}>/, 'the moving digits reach a screen reader');
    assert.match(body, /fontVariant: \['tabular-nums'\]/, 'the digits are not tabular');
    assert.match(body, /\{widest\}/, 'nothing holds the count to its widest value, so what is beside it shuffles');
    assert.match(body, /createCountTicks\(to, tick\)/, 'the ticks do not go through countTicks.ts');
    assert.match(body, /COUNT_FRAME_MS/, 'the count redraws faster than 30 times a second');
  });

  test('the waiting pill is reported busy, draws its check only when done, and answers an error with nothing', () => {
    const body = code('MorphButton.tsx');
    assert.match(body, /<Press\b/, 'the pill does not press through the one Press');
    assert.match(body, /accessibilityState=\{\{ busy: state === 'busy', disabled: locked \}\}/, 'a waiting pill is not reported busy');
    assert.match(body, /const locked = disabled \|\| state === 'busy' \|\| state === 'done';/, 'a waiting or finished pill can be pressed again');
    assert.match(body, /announceForAccessibility\(latest\.current\.busyLabel\)/, 'waiting is not announced');
    assert.match(body, /announceForAccessibility\(latest\.current\.doneLabel\)/, 'finishing is not announced');
    // The success haptic and the caller's continue belong to done alone.
    const done = body.slice(body.indexOf("if (state !== 'done') return undefined;"));
    assert.ok(body.includes("if (state !== 'done') return undefined;"), 'the success answer is not held to done');
    assert.equal((body.match(/\barrived\(\)/g) ?? []).length, 1, 'the success haptic is played somewhere else too');
    assert.ok(done.includes('arrived()'), 'the success haptic is not inside the done branch');
    // No shake and no other haptic anywhere: an error says nothing physical.
    assert.doesNotMatch(body, /\b(?:pressed|soft|thump|tick|celebrate|tapSettled)\(\)|translateX/, 'the pill shakes or answers an error physically');
    // Only width, height and the corner animate, and the spinner stops.
    assert.match(body, /useAnimatedStyle\(\(\) => \(\{ width: wide\.value, height: tall\.value, borderRadius: round\.value \}\)\)/);
    assert.match(body, /setTimeout\(\(\) => cancel\(turn\), MORPH\.spinMax\)/, 'the spinner can turn for ever');
  });

  test('the progress ring draws on the web from state, at most 30 times a second', () => {
    const native = code('ProgressRing.tsx');
    const web = code('ProgressRing.web.tsx');
    assert.match(native, /useAnimatedProps\(/, 'the device ring no longer draws on the UI thread');
    assert.doesNotMatch(web, /useAnimatedProps\(|createAnimatedComponent\(/, 'the web ring animates an Svg prop, the open risk W2');
    assert.match(web, /strokeDashoffset=\{length \* \(1 - shown\)\}/, 'the web ring is not drawn from state');
    assert.match(web, /COUNT_FRAME_MS/, 'the web ring redraws faster than 30 times a second');
    for (const body of [native, web]) assert.match(body, /useRingDraw\(\{ reduced,/, 'the two halves no longer share one run');
  });

  test('a cascade and a bubble take reduced motion from Enter alone, so a late answer still staggers', () => {
    // Enter waits for the OS and lands at once when movement is reduced, so a
    // place in the cascade or a rise handed to it under reduced motion moves
    // nothing. A second answer read here could arrive a commit apart from
    // Enter's: the cascade would start at index 0 for good, or a bubble's rise
    // would change while it travelled.
    for (const file of Object.keys(ANSWERED_BY)) {
      assert.doesNotMatch(code(file), /\buseReduceMotion\b|\breduced\b/, `motion/${file} asks for reduced motion beside the Enter it is built on`);
    }
    assert.match(code('StaggerIn.tsx'), /index=\{Math\.min\(i, cascading - 1\)\}/, 'a child is not given its real place in the cascade');
    assert.match(code('BubbleIn.tsx'), /distance=\{shape\.rise\}/, 'a bubble is not given its rise');
    assert.match(code('BubbleIn.tsx'), /scaleFrom=\{shape\.from\}/, 'a bubble is not given its growth');
    // What makes that safe: Enter at rest has no rise and no growth, whatever it was handed.
    const enter = code('layout.tsx');
    assert.match(enter, /const reduced = useAnswered\(useReduceMotion\(true\)\);/, 'Enter does not wait for the OS answer');
    assert.match(enter, /translateY: \(1 - shown\.value\) \* rise \}, \{ scale: scaleFrom \+ \(1 - scaleFrom\) \* shown\.value \}/, 'Enter at rest keeps some rise or growth');
  });

  test('the waiting pill takes its measured shape before the render that first draws it', () => {
    // The shape style is used from the render after the first measure, and the
    // effect that shapes the pill runs only once that render is on screen: left
    // to it, the pill is drawn for one frame at 0 by 0.
    const body = code('MorphButton.tsx');
    const measure = body.slice(body.indexOf('const measure = '), body.indexOf('const locked = '));
    assert.ok(measure.includes('setBox('), 'the measure no longer stores the box, so this check reads nothing');
    const shaped = measure.indexOf('still(state, reduced, { width, height });');
    assert.notEqual(shaped, -1, 'the measure does not shape the pill to the box it measured');
    assert.ok(shaped < measure.indexOf('setBox('), 'the pill is shaped only after the render that first draws it');
    assert.match(body, /\(now: MorphState, calm: boolean, size: \{ width: number; height: number \} \| null = latest\.current\.box\) => \{/, 'still cannot be handed a box that is not stored yet');
    assert.match(body, /wide\.value = closed \? MORPH\.size : size\?\.width \?\? 0;/, 'the width is not the box handed in');
    assert.match(body, /tall\.value = closed \? MORPH\.size : size\?\.height \?\? 0;/, 'the height is not the box handed in');
  });

  test('a next-tick answer is cleared when the ring or the bar goes, and a remount is on screen again', () => {
    for (const file of ['useRingDraw.ts', 'LivingBar.tsx']) {
      const body = code(file);
      // One handle kept, replaced rather than stacked.
      assert.match(body, /if \(answer\.current !== null\) clearTimeout\(answer\.current\);\s*answer\.current = setTimeout\(settle, 0\);/, `motion/${file} drops the handle of its next-tick answer`);
      assert.doesNotMatch(body.replace(/answer\.current = setTimeout\(settle, 0\);/g, ''), /\bsetTimeout\(/, `motion/${file} sets a timer it does not keep`);
      // Cleared when it goes, and on screen again when StrictMode or Fast Refresh runs the body again.
      assert.match(
        body,
        /useEffect\(\(\) => \{\s*alive\.current = true;\s*return \(\) => \{\s*alive\.current = false;\s*if \(answer\.current !== null\) clearTimeout\(answer\.current\);/,
        `motion/${file} leaves its next-tick answer running after it has gone, or stays gone after a remount`,
      );
    }
  });

  test('only a real unmount lands a primitive', () => {
    // The decision itself is unmount.ts's, driven in unmount.test.ts; this holds the hook to it.
    const landing = code('landing.ts');
    assert.match(landing, /import \{ createUnmountGuard \} from '\.\/unmount\.ts';/, 'useLandOnLeave does not use the unmount guard');
    assert.match(landing, /const \[guard\] = useState\(\(\) => createUnmountGuard\(\)\);/, 'useLandOnLeave builds a new guard each render');
    assert.match(landing, /useEffect\(\(\) => \{\s*guard\.mounted\(\);/, 'a remount is not marked as on screen again');
    assert.doesNotMatch(landing, /return \(\) => \{\s*subscription\.remove\(\);\s*latest\.current\(\);/, 'useLandOnLeave lands in the cleanup itself, so a rehearsal lands a one-shot for good');
  });
});
