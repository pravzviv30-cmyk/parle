/**
 * The motion rules, enforced.
 *
 * DESIGN.md has said since the splash shipped that the app has exactly one
 * motion vocabulary and the next animated screen must not invent a second:
 * transform and opacity only, always on the native driver, never an SVG
 * attribute, one loop plus one settling entrance, nothing bounces. Until now
 * that was prose, and prose does not fail a build.
 *
 * This is `copy.test.ts`'s idiom pointed at movement instead of words: walk
 * every non-test source file, strip comments, and fail on the shapes that
 * break a rule. It is a tripwire rather than a proof, exactly as
 * `nav/wiring.test.ts` says of itself, because apps/mobile has no renderer.
 * A tripwire that catches the two mistakes anyone actually makes is worth
 * more than a proof nobody can run.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\.tsx?$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** Same treatment as copy.test.ts: comments are allowed to say anything. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** The text from an opening paren to the one that closes it. */
function callBody(source: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < source.length; i += 1) {
    const c = source[i];
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen, i + 1);
    }
  }
  return source.slice(openParen);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

const FILES = sourceFiles(SRC).map((path) => ({
  path,
  short: relative(SRC, path),
  body: stripComments(readFileSync(path, 'utf8')),
}));

describe('every animation crosses to the native driver', () => {
  test('no Animated.timing runs without useNativeDriver: true', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      let at = file.body.indexOf('Animated.timing(');
      while (at !== -1) {
        const body = callBody(file.body, at + 'Animated.timing'.length);
        if (!/useNativeDriver:\s*(?:true|NATIVE_DRIVER|Platform\.OS !== 'web')/.test(body)) {
          offenders.push(`${file.short}:${lineOf(file.body, at)}`);
        }
        at = file.body.indexOf('Animated.timing(', at + 1);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `A timing without useNativeDriver runs the whole animation on the JS thread:\n${offenders.join('\n')}`,
    );
  });

  test('the one spring is the press, it lives in motion.ts at the STYLE numbers, and it crosses to the native driver everywhere but the web', () => {
    // Revamp B, F597. This used to read "nothing bounces", and STYLE section
    // 11 overturned it on purpose: every tappable thing scales to 0.97 on a
    // spring of response 0.3 and damping 0.7, which overshoots a little by
    // design. So the rule is no longer "no spring" but "one spring": written
    // once, in motion.ts, at the converted numbers, and called from `Press`.
    const springs = FILES.filter((f) => /Animated\.spring\(/.test(f.body)).map((f) => f.short);
    assert.deepEqual(springs, ['motion.ts'], `a second spring was written outside the press:\n${springs.join('\n')}`);
    const motion = FILES.find((f) => f.short === 'motion.ts');
    assert.ok(motion, 'motion.ts moved');
    const at = motion.body.indexOf('Animated.spring(');
    assert.equal(motion.body.indexOf('Animated.spring(', at + 1), -1, 'motion.ts holds two springs; the press is the one');
    const call = callBody(motion.body, at + 'Animated.spring'.length);
    for (const number of [/stiffness: 439\b/, /damping: 29\.3\b/, /mass: 1\b/, /useNativeDriver: NATIVE_DRIVER\b/]) {
      assert.match(call, number, `the press spring is not STYLE's response 0.3 and damping 0.7, converted: ${call.replace(/\s+/g, ' ')}`);
    }
    assert.match(motion.body, /export const PRESS_SCALE = 0\.97;/, 'a press does not scale to STYLE\'s 0.97');
    assert.match(
      motion.body,
      /export const NATIVE_DRIVER = Platform\.OS !== 'web';/,
      'the spring asks for the native driver on the web, where the module is absent and the spring stalls',
    );
  });
});

describe('nothing animates a thing the native driver cannot carry', () => {
  test('no animated component is built over an SVG or a layout prop', () => {
    // `Animated.createAnimatedComponent` is the only way to reach an SVG
    // attribute such as r, d, cx or cy, and those cannot cross to the native
    // driver: binding one drops the whole animation onto the JS thread. It is
    // also how a width or a height gets animated, which is a layout pass per
    // frame. If a future scene genuinely needs one, this test is the
    // conversation about it.
    const offenders: string[] = [];
    for (const file of FILES) {
      const at = file.body.indexOf('Animated.createAnimatedComponent');
      if (at !== -1) offenders.push(`${file.short}:${lineOf(file.body, at)}`);
    }
    assert.deepEqual(
      offenders,
      [],
      `Only transform and opacity may move:\n${offenders.join('\n')}`,
    );
  });

  test('no interpolation is handed to a geometry or layout prop', () => {
    const BANNED = ['r', 'd', 'cx', 'cy', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'strokeWidth', 'width', 'height', 'left', 'top'];
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const prop of BANNED) {
        const re = new RegExp(`\\b${prop}=\\{[^}]*\\.interpolate\\(`, 'g');
        let m = re.exec(file.body);
        while (m) {
          offenders.push(`${file.short}:${lineOf(file.body, m.index)}  ${prop}`);
          m = re.exec(file.body);
        }
      }
    }
    assert.deepEqual(offenders, [], `These cannot cross to the native driver:\n${offenders.join('\n')}`);
  });
});

describe('the illustration module keeps its own rules', () => {
  const scenes = FILES.filter((f) => f.short.startsWith(join('illustrations', 'scenes')));

  test('there are scenes to check', () => {
    assert.ok(scenes.length > 0, 'illustrations/scenes is empty, so this whole suite is asserting nothing');
  });

  test('every scene hides itself from a screen reader', () => {
    // The drawings carry no information the surrounding text does not already
    // say, so assistive tech should walk straight past rather than announce an
    // unlabelled image. A scene may satisfy this either by drawing through the
    // pen's primitives, which spread `decorative` on every Svg they render, or
    // by spreading it itself when it renders its own.
    //
    // The pen is matched at any depth because a scene may sit in a subfolder of
    // `scenes/` — the daily pack does — and `../../pen.tsx` is the same pen as
    // `../pen.tsx`. The rule is unchanged: reach the pen, or hide yourself.
    const offenders = scenes
      .filter((f) => !f.body.includes('decorative') && !/from '(?:\.\.\/)+pen\.tsx'/.test(f.body))
      .map((f) => f.short);
    assert.deepEqual(offenders, [], `A scene that is announced as an unlabelled image:\n${offenders.join('\n')}`);
  });

  test('the pen hides every Svg it renders', () => {
    // The check above trusts the primitives, so the primitives get checked.
    const pen = FILES.find((f) => f.short === join('illustrations', 'pen.tsx'));
    assert.ok(pen, 'illustrations/pen.tsx has moved, and the scene check above trusts it');
    const opens = pen.body.split('<Svg').length - 1;
    const hidden = pen.body.split('{...decorative}').length - 1;
    assert.ok(
      opens > 0 && hidden >= opens,
      `pen.tsx renders ${opens} Svg elements and spreads decorative ${hidden} times`,
    );
  });

  test('every scene draws at the one stroke weight', () => {
    const offenders: string[] = [];
    for (const file of scenes) {
      const re = /strokeWidth=\{([^}]*)\}/g;
      let m = re.exec(file.body);
      while (m) {
        const value = (m[1] ?? '').trim();
        const ok = value === 'STROKE' || value.includes('STROKE');
        if (!ok) offenders.push(`${file.short}:${lineOf(file.body, m.index)}  strokeWidth={${value}}`);
        m = re.exec(file.body);
      }
    }
    assert.deepEqual(offenders, [], `One pen drew the whole app:\n${offenders.join('\n')}`);
  });

  test('no scene reaches for navigation', () => {
    // `useIsFocused` throws outside a NavigationContainer, and five of the
    // places that render a scene are outside one: the splash, the welcome
    // screen and the four onboarding pages all mount above the navigator. So
    // pausing a loop is the SCREEN's job, passed in as a prop, never something
    // a scene decides for itself.
    const offenders = FILES.filter(
      (f) => f.short.startsWith('illustrations') && /useIsFocused|useNavigation/.test(f.body),
    ).map((f) => f.short);
    assert.deepEqual(
      offenders,
      [],
      `A scene that calls into navigation crashes on the splash:\n${offenders.join('\n')}`,
    );
  });
});

/**
 * The glyph layer keeps the illustrations' pen — F589.
 *
 * Revamp A doubled the number of line-art marks in the app: a disc with a glyph
 * in it now heads most rows, and the set lives in `glyphs.tsx` beside the five
 * tab icons in `nav/icons.tsx`. The scenes have been held to one stroke weight
 * since the splash shipped; the icons never were, and a second weight in a row
 * of discs is the first thing an eye catches. So the same walk covers both.
 */
describe('the glyph layer draws with the same pen as the scenes', () => {
  const PENS = ['glyphs.tsx', join('nav', 'icons.tsx')];
  const pens = FILES.filter((f) => PENS.includes(f.short));

  test('both glyph files are here to check', () => {
    assert.deepEqual(
      pens.map((f) => f.short).sort(),
      [...PENS].sort(),
      'a glyph file has moved, so the stroke-weight walk below is reading nothing',
    );
  });

  test('every glyph draws at the one stroke weight', () => {
    const offenders: string[] = [];
    for (const file of pens) {
      const re = /strokeWidth=\{([^}]*)\}/g;
      let m = re.exec(file.body);
      while (m) {
        const value = (m[1] ?? '').trim();
        if (!value.includes('STROKE')) offenders.push(`${file.short}:${lineOf(file.body, m.index)}  strokeWidth={${value}}`);
        m = re.exec(file.body);
      }
      assert.ok(
        /strokeWidth=\{/.test(file.body),
        `${file.short} sets no stroke weight at all, so every mark in it is drawn at the SVG default of 1`,
      );
    }
    assert.deepEqual(offenders, [], `One pen drew the whole app:\n${offenders.join('\n')}`);
  });

  test('a glyph moves nothing at all', () => {
    // A mark that animates is a mark that has to be paused, and none of these
    // is ever handed a `paused` prop. The orb is the one drawing that moves and
    // it moves from `VoiceOrb.tsx`, one level above its own Svg.
    const offenders = pens.filter((f) => /Animated|useEffect|interpolate/.test(f.body)).map((f) => f.short);
    assert.deepEqual(offenders, [], `A glyph that animates itself:\n${offenders.join('\n')}`);
  });
});

/**
 * Only the orb and the highlighter move — notebook Phase 1, added 2026-09-27.
 *
 * The design contract keeps two movements: the orb's breathing and wave lines,
 * and the highlighter drawing in once behind a French line. Touch feedback is
 * not motion here, because a pressed style is not an Animated value.
 *
 * Today's tree does not yet pass the target, so this is a ratchet: the set of
 * files that animate is pinned exactly, the target files are named apart from
 * the pending ones, and the pending list may only shrink. Each pending file is
 * a screen or a scene that a later phase removes: the rotating greeting, the
 * daily drawings, SpeakBubbles, the welcome steam, the RewardMark motion.
 */
describe('only the orb and the highlighter move', () => {
  // 2026-10-06 (F790): the founder asked for the launch to be the mark coming
  // alive, Hum's ring turning around the orb while the app opens. It is the orb
  // moving, which this contract already keeps, so launch/LaunchScreen.tsx joins
  // the target list on the same rules: one loop, one settling entrance,
  // transform and opacity on the native driver, the final frame under reduce
  // motion. src/launch/launchScreen.test.ts holds it to them.
  const TARGET = ['components.tsx', 'motion.ts', join('tutor', 'VoiceOrb.tsx'), join('recap', 'OnceConfetti.tsx'), join('motion', 'Feedback.tsx'), join('launch', 'LaunchScreen.tsx')];
  // 2026-09-27, notebook Phase 3 (B1): the rotating greeting (and its hook
  // file), the DailyCard entrance and the Speak tab's settle-in entrance were
  // removed, so daily/DailyCard.tsx, home/useGreetingRotation.ts and
  // tabs/TutorTab.tsx came off this list. It may only shrink.
  // 2026-09-27, notebook Phase 4 (B2): RewardMark is a still mark beside the
  // drill verdict, so illustrations/scenes/reward.tsx came off this list; and
  // the rebuilt onboarding (Phase 5) no longer animates, so
  // onboarding/PreAccountOnboarding.tsx came off it too.
  // 2026-09-27, notebook Phase 4 (B1): the mission win card and the thread
  // arrive in place, so ConvoScreen.tsx and tutor/Transcript.tsx came off it.
  const PENDING: string[] = [];

  test('the files that animate are the orb, the highlighter and the pending list, and nothing new', () => {
    const moving = FILES.filter((f) => /\bAnimated\./.test(f.body)).map((f) => f.short).sort();
    assert.deepEqual(
      moving,
      [...TARGET, ...PENDING, 'onboarding/ChoiceCard.tsx', 'onboarding/NextButton.tsx', 'onboarding/OnboardingMotion.tsx'].sort(),
      'a file started or stopped animating; a new one is refused, and one that stopped comes off the pending list',
    );
  });

  test('the tab bar is still: no wash, no lift, no animation', () => {
    const bar = FILES.find((f) => f.short === join('nav', 'LuvaniTabBar.tsx'));
    assert.ok(bar, 'the tab bar moved, so this check reads nothing');
    assert.doesNotMatch(bar.body, /\bAnimated\b|useReduceMotion|interpolate/, 'the tab bar animates again');
  });

  test('the draw-in has one set of numbers, in motion.ts', () => {
    const offenders = FILES.filter(({ short, body }) => short !== 'motion.ts' && /\bDRAW_MS\s*=/.test(body)).map((f) => f.short);
    assert.deepEqual(offenders, [], 'the draw-in duration is written outside motion.ts');
    const motion = FILES.find((f) => f.short === 'motion.ts');
    assert.ok(motion, 'motion.ts moved');
    assert.match(motion.body, /export const DRAW_MS = \d+;/, 'the draw-in has no named duration');
  });
});
