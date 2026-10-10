/**
 * The motion rules, enforced.
 *
 * DESIGN.md has said since the splash shipped that the app has exactly one
 * motion vocabulary and the next animated screen must not invent a second.
 * Until the first of these tests that was prose, and prose does not fail a
 * build.
 *
 * Come alive (October 2026) brought one engine, Reanimated, and this file is
 * its rule set (DESIGN.md, Motion, Enforcement):
 *
 * 0. `Animated` always means React Native's legacy module. Reanimated is
 *    imported as `Reanimated`.
 * 1. Engines (Reanimated, Worklets) are imported only from the named
 *    directories and files below, and in components.tsx only by `Press`.
 * 2. The legacy `Animated` file list is reviewed explicitly, including the shared onboarding transition.
 * 3. Every file that moves reads reduced motion from motion.ts, live.
 * 4. A loop runs only in a file that can pause it.
 * 5. One door to the engine: `with*` calls live in motion/drive.ts alone, and
 *    every spring is a named token.
 * 6. SVG and layout: only dash offsets and opacity animate through props, and
 *    only MorphButton animates a layout prop.
 * 7. No test loads a module that imports an animation, audio or haptics engine.
 *
 * The allow-lists are directories and named files, so a later step that adds a
 * primitive under `motion/` or `celebrate/` needs no edit here.
 *
 * This is `copy.test.ts`'s idiom pointed at movement instead of words: walk
 * every non-test source file, strip comments, and fail on the shapes that
 * break a rule. It is a tripwire rather than a proof, exactly as
 * `nav/wiring.test.ts` says of itself, because apps/mobile has no renderer.
 */

import ts from 'typescript';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const APP = join(SRC, '..');

function sourceFiles(dir: string, withTests = false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full, withTests));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (!withTests && /\.test\.tsx?$/.test(entry.name)) continue;
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

/** The top-level arguments of a call body, `(a, b(c, d), e)` giving `a`, `b(c, d)`, `e`. */
function topArgs(body: string): string[] {
  const inner = body.slice(1, -1);
  const args: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const c = inner[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (c === ',' && depth === 0) {
      args.push(inner.slice(from, i).trim());
      from = i + 1;
    }
  }
  const last = inner.slice(from).trim();
  if (last !== '') args.push(last);
  return args;
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Every match of a global pattern, with where it is. */
function* every(source: string, pattern: RegExp): Generator<RegExpExecArray> {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let m = re.exec(source);
  while (m) {
    yield m;
    m = re.exec(source);
  }
}

/** A path relative to src, always with forward slashes, so the lists below read the same on any machine. */
const shortOf = (path: string): string => relative(SRC, path).split(sep).join('/');

const FILES = sourceFiles(SRC).map((path) => ({
  path,
  short: shortOf(path),
  body: stripComments(readFileSync(path, 'utf8')),
}));

const file = (short: string) => {
  const found = FILES.find((f) => f.short === short);
  assert.ok(found, `${short} moved, so the check that reads it reads nothing`);
  return found;
};

/** The region of a source from one `export function` to the next export, or to the end. */
function region(body: string, name: string): string {
  const at = body.indexOf(`export function ${name}(`);
  assert.notEqual(at, -1, `${name} is missing`);
  const next = body.indexOf('\nexport ', at + 1);
  return body.slice(at, next === -1 ? undefined : next);
}

/**
 * Import statements that load something when the file runs. `import type` and
 * `export type` are erased before anything loads, so they are not loads.
 */
function runtimeImports(body: string): { spec: string; clause: string; index: number }[] {
  const out: { spec: string; clause: string; index: number }[] = [];
  // Parse executable syntax: imports inside fixture strings are data, not loads.
  const source = ts.createSourceFile('imports.tsx', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) {
      out.push({ spec: node.moduleSpecifier.text, clause: node.importClause?.getText(source) ?? '', index: node.getStart(source) });
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push({ spec: node.moduleSpecifier.text, clause: node.exportClause?.getText(source) ?? '*', index: node.getStart(source) });
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const spec = node.arguments[0];
      if (spec && ts.isStringLiteral(spec)) out.push({ spec: spec.text, clause: '', index: node.getStart(source) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const ENGINES = ['react-native-reanimated', 'react-native-worklets'];
/** The native modules a Node suite cannot load: the engines, and the audio and haptics modules. */
const UNLOADABLE = [...ENGINES, 'expo-audio', 'expo-haptics'];
const isPackage = (spec: string, names: readonly string[]): boolean =>
  names.some((name) => spec === name || spec.startsWith(`${name}/`));

const importsEngine = (body: string): boolean => runtimeImports(body).some(({ spec }) => isPackage(spec, ENGINES));

/** Rule 1: where an engine may be imported. Directories end in a slash. */
const ENGINE_DIRS = ['motion/', 'celebrate/', 'game/art/', 'onboarding/firstRun/'];
const ENGINE_FILES = [
  'icons/AnimatedIcon.tsx',
  'nav/TabGlyph.tsx',
  'drill/AnswerSheet.tsx',
  'speech/useRecorderLevel.ts',
  // The password meter animates a stable fill transform and its strength colour.
  'auth/PasswordMeter.tsx',
  // The founder's Figma sign-in glow pauses for auth, reduced motion and visibility.
  'auth/WelcomeSignInGlow.tsx',
  // Only inside the `Press` region; the next test holds that.
  'components.tsx',
];
const engineAllowed = (short: string): boolean =>
  ENGINE_DIRS.some((dir) => short.startsWith(dir)) ||
  ENGINE_FILES.includes(short) ||
  /^tutor\/(?:Orb|LiveBars)[^/]*\.tsx?$/.test(short) ||
  /^live\/RoomLevels[^/]*\.tsx?$/.test(short);

/** Rule 2: the reviewed files using native transform/opacity `Animated` primitives. */
const LEGACY_ANIMATED = [
  'components.tsx',
  'motion.ts',
  'motion/Feedback.tsx',
  'onboarding/NextButton.tsx',
  'onboarding/OnboardingMotion.tsx',
  'tutor/VoiceOrb.tsx',
  // Preserve main's independently shipped Hum launch on its existing engine.
  'launch/LaunchScreen.tsx',
  // Bounded onboarding action/reveal and account primitives.
  'onboarding/motion/OnboardingScenes.tsx',
  'onboarding/AccountWelcome.tsx',
  // One shared transition/progress owner; its consumers only render its style.
  'onboarding/OnboardingLayout.tsx',
  'onboarding/OnboardingFlow.tsx',
  'onboarding/PreAccountOnboarding.tsx',
  'auth/AuthFlow.tsx',
  'dev/OnboardingPreview.tsx',
];
const usesLegacyAnimated = (body: string): boolean =>
  /\bAnimated\./.test(body) ||
  runtimeImports(body).some(({ spec, clause }) => spec === 'react-native' && /\bAnimated\b/.test(clause));

/** Rule 4: where a loop may run. */
const LOOP_FILES = ['launch/LaunchScreen.tsx', 'tutor/VoiceOrb.tsx', 'motion/MorphButton.tsx', 'icons/AnimatedIcon.tsx'];
const loopAllowed = (short: string): boolean =>
  LOOP_FILES.includes(short) || /^tutor\/(?:Orb|LiveBars)[^/]*\.tsx?$/.test(short);

/** The two files exempt from rule 3: they hold numbers and the door, and move nothing themselves. */
const NO_HOOK_NEEDED = ['motion/tokens.ts', 'motion/drive.ts'];

describe('every animation crosses to the native driver', () => {
  test('timings use the native driver except the bounded onboarding width fill', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const m of every(f.body, /\bAnimated\.timing\(/g)) {
        const body = callBody(f.body, m.index + 'Animated.timing'.length);
        if (f.short === 'onboarding/OnboardingLayout.tsx' && /Animated\.timing\(fill,/.test(m[0] + body.slice(1))) {
          assert.match(body, /duration: reduced \? 0 : 320/);
          assert.match(body, /useNativeDriver: false/);
          assert.match(f.body, /width: fill\.interpolate\(\{ inputRange: \[0, 1\], outputRange: \['0%', '100%'\]/);
          continue;
        }
        if (!/useNativeDriver:\s*(?:true|NATIVE_DRIVER|Platform\.OS !== 'web')/.test(body)) {
          offenders.push(`${f.short}:${lineOf(f.body, m.index)}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `A timing without useNativeDriver runs the whole animation on the JS thread:\n${offenders.join('\n')}`,
    );
  });

  test('the one spring is the press, it lives in motion.ts at the STYLE numbers, and it crosses to the native driver everywhere but the web', () => {
    // Revamp B, F597: every tappable thing scales to 0.97 on a spring of
    // response 0.3 and damping 0.7, written once and called from `Press`.
    // Come alive moves that spring onto Reanimated, which runs it on the UI
    // thread on a device and on the JS thread on the web. The numbers are the
    // `press` token, unchanged, `pressTo` in motion.ts is still the one press,
    // and the legacy `Animated.spring` is gone everywhere.
    const legacy = FILES.filter((f) => /\bAnimated\.spring\(/.test(f.body)).map((f) => f.short);
    assert.deepEqual(legacy, [], `a legacy spring was written beside the press:\n${legacy.join('\n')}`);

    const tokens = file('motion/tokens.ts').body;
    assert.match(tokens, /press: \{ stiffness: 439, damping: 29\.3, mass: 1 \}/, 'the press spring is not STYLE\'s response 0.3 and damping 0.7, converted');
    const numbers = FILES.filter((f) => /\bstiffness\s*:/.test(f.body)).map((f) => f.short);
    assert.deepEqual(numbers, ['motion/tokens.ts'], `spring numbers are written outside the tokens:\n${numbers.join('\n')}`);

    const motion = file('motion.ts').body;
    const press = motion.slice(motion.indexOf('export function pressTo('));
    assert.ok(motion.includes('export function pressTo('), 'motion.ts has no press');
    assert.match(press, /if \(reduced\) \{\s*value\.value = to;\s*return;\s*\}/, 'reduced motion does not land the press at once');
    assert.match(press, /value\.value = spring\(to, SPRING\.press, reduced\);/, 'the press does not run on the press spring with the live reduced answer');
    assert.match(motion, /export const PRESS_SCALE = 0\.97;/, 'a press does not scale to STYLE\'s 0.97');
    assert.match(
      motion,
      /export const NATIVE_DRIVER = Platform\.OS !== 'web';/,
      'the legacy timings ask for the native driver on the web, where the module is absent and they stall',
    );
  });
});

describe('nothing animates a thing the native driver cannot carry', () => {
  test('no animated component is built over an SVG or a layout prop', () => {
    // The legacy `Animated.createAnimatedComponent` stays refused everywhere:
    // binding an SVG attribute drops the whole animation onto the JS thread.
    // Reanimated's animates on the UI thread, so a ring may draw by its dash
    // offset, but only in a file the engine is allowed in, never over a
    // Pressable (the press shrinks its surface, not itself), and its animated
    // props are dash offsets and opacity, nothing that changes geometry.
    const offenders: string[] = [];
    const PROPS = new Set(['strokeDashoffset', 'opacity', 'fillOpacity', 'strokeOpacity']);
    for (const f of FILES) {
      for (const m of every(f.body, /\bAnimated\.createAnimatedComponent\b/g)) {
        offenders.push(`${f.short}:${lineOf(f.body, m.index)}  legacy createAnimatedComponent`);
      }
      for (const m of every(f.body, /(?<!\bAnimated\.)\bcreateAnimatedComponent\(\s*([\w.]+)/g)) {
        if (!engineAllowed(f.short)) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  createAnimatedComponent outside the engine's files`);
        if (/Pressable|Touchable/.test(m[1] ?? '')) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  an animated ${m[1]}`);
      }
      for (const m of every(f.body, /\buseAnimatedProps\(/g)) {
        const body = callBody(f.body, m.index + 'useAnimatedProps'.length);
        for (const key of every(body, /[{,]\s*(\w+)\s*:/g)) {
          if (!PROPS.has(key[1]!)) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  animated prop ${key[1]}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `Only transform, opacity and dash offsets may move:\n${offenders.join('\n')}`);
  });

  test('no interpolation is handed to a geometry or layout prop', () => {
    const BANNED = ['r', 'd', 'cx', 'cy', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'strokeWidth', 'width', 'height', 'left', 'top'];
    const offenders: string[] = [];
    for (const f of FILES) {
      for (const prop of BANNED) {
        for (const m of every(f.body, new RegExp(`\\b${prop}=\\{[^}]*\\.interpolate\\(`, 'g'))) {
          offenders.push(`${f.short}:${lineOf(f.body, m.index)}  ${prop}`);
        }
      }
      // An animated style that moves a layout prop runs a layout pass per
      // frame. MorphButton's width, the busy button closing to a circle, is
      // the one allowed.
      if (f.short === 'motion/MorphButton.tsx') continue;
      for (const m of every(f.body, /\buseAnimatedStyle\(/g)) {
        const body = callBody(f.body, m.index + 'useAnimatedStyle'.length);
        for (const key of every(body, /[{,]\s*(width|height|top|left|right|bottom|margin\w*|padding\w*)\s*:/g)) {
          offenders.push(`${f.short}:${lineOf(f.body, m.index)}  animated ${key[1]}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `These cannot cross to the native driver:\n${offenders.join('\n')}`);
  });
});

describe('the illustration module keeps its own rules', () => {
  const scenes = FILES.filter((f) => f.short.startsWith('illustrations/scenes'));

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
    const pen = FILES.find((f) => f.short === 'illustrations/pen.tsx');
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
    for (const f of scenes) {
      for (const m of every(f.body, /strokeWidth=\{([^}]*)\}/g)) {
        const value = (m[1] ?? '').trim();
        const ok = value === 'STROKE' || value.includes('STROKE');
        if (!ok) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  strokeWidth={${value}}`);
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
 *
 * Come alive (D11) moved every drawing into the generated set in `icons/`, and
 * `glyphs.tsx` and `nav/icons.tsx` became delegates to it. So the pens are now
 * the generated files, found by their header, and the two old files are held
 * to drawing nothing of their own.
 */
describe('the glyph layer draws with the same pen as the scenes', () => {
  const GENERATED_HEADER = '// Generated by scripts/icons/build-icons.mjs';
  const pens = FILES.filter((f) => f.short.startsWith('icons/') && readFileSync(f.path, 'utf8').startsWith(GENERATED_HEADER) && f.short.endsWith('.tsx'));
  const DELEGATES = ['glyphs.tsx', 'nav/icons.tsx'];
  const delegates = FILES.filter((f) => DELEGATES.includes(f.short));
  /** The hand-written icon parts that draw but never move. AnimatedIcon is the one that moves. */
  const STILL = ['icons/Icon.tsx', 'icons/IconTile.tsx', 'icons/GoalDial.tsx'];

  test('both glyph files are here to check', () => {
    assert.deepEqual(
      delegates.map((f) => f.short).sort(),
      [...DELEGATES].sort(),
      'a glyph file has moved, so the walk below is reading nothing',
    );
    assert.ok(pens.length >= 90, `only ${pens.length} generated icon files were found, so the stroke-weight walk below reads almost nothing`);
    for (const short of STILL) file(short);
  });

  test('every glyph draws at the one stroke weight', () => {
    const offenders: string[] = [];
    for (const f of [...pens, file('icons/GoalDial.tsx')]) {
      for (const m of every(f.body, /strokeWidth=\{([^}]*)\}/g)) {
        const value = (m[1] ?? '').trim();
        if (value !== 'STROKE') offenders.push(`${f.short}:${lineOf(f.body, m.index)}  strokeWidth={${value}}`);
      }
      // A mark that strokes and says no weight is drawn at the SVG default of 1.
      for (const m of every(f.body, /<(?!Svg|G\b)\w+ [^>]*\bstroke=\{\w+\}[^>]*>/g)) {
        if (!m[0].includes('strokeWidth={STROKE}')) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  a stroke at the default weight`);
      }
    }
    for (const f of delegates) {
      if (/strokeWidth=|<Svg\b/.test(f.body)) offenders.push(`${f.short}  draws a mark of its own beside the generated set`);
    }
    assert.deepEqual(offenders, [], `One pen drew the whole app:\n${offenders.join('\n')}`);
  });

  test('a glyph moves nothing at all', () => {
    // A mark that animates is a mark that has to be paused, and none of these
    // is ever handed a `paused` prop. The orb is the one drawing that moves and
    // it moves from `VoiceOrb.tsx`, one level above its own Svg; an icon that
    // moves does so in `icons/AnimatedIcon.tsx`, around a still mark, and that
    // file is the one named exception.
    const still = [...pens, ...delegates, ...STILL.map(file)];
    const offenders = still.filter((f) => /Animated|useEffect|interpolate/.test(f.body) || importsEngine(f.body)).map((f) => f.short);
    assert.deepEqual(offenders, [], `A glyph that animates itself:\n${offenders.join('\n')}`);
    const moving = FILES.filter((f) => f.short.startsWith('icons/') && importsEngine(f.body)).map((f) => f.short);
    assert.deepEqual(moving, ['icons/AnimatedIcon.tsx'], 'an icon file other than AnimatedIcon moves');
  });
});

/**
 * What may move, and where — rules 1 and 2.
 *
 * Until come alive this was a pinned list of the five files that animated. The
 * engine arrived with a set of primitives and a celebration host, so the list
 * became two: where the engine may be imported (directories and named files,
 * so a new primitive needs no edit here), and the legacy `Animated` files, a
 * list that may only shrink as each one moves onto the engine.
 */
describe('only the orb and the highlighter move', () => {
  test('the files that animate are the orb, the highlighter and the pending list, and nothing new', () => {
    const engine = FILES.filter((f) => importsEngine(f.body)).map((f) => f.short);
    const strays = engine.filter((short) => !engineAllowed(short));
    assert.deepEqual(
      strays,
      [],
      `A screen imports the engine itself; screens compose the primitives in motion/ and celebrate/ instead:\n${strays.join('\n')}`,
    );
    // Rule 0: Reanimated is `Reanimated`, so `Animated` stays the legacy name
    // and every `\bAnimated\.` check in this repository keeps meaning one thing.
    const misnamed: string[] = [];
    for (const f of FILES) {
      for (const { spec, clause, index } of runtimeImports(f.body)) {
        if (spec === 'react-native-reanimated' && /^\s*Animated\b|\bdefault as Animated\b/.test(clause)) {
          misnamed.push(`${f.short}:${lineOf(f.body, index)}`);
        }
      }
    }
    assert.deepEqual(misnamed, [], `Reanimated is imported under the legacy name; import it as Reanimated:\n${misnamed.join('\n')}`);

    // In components.tsx the engine belongs to `Press` alone.
    const components = file('components.tsx').body;
    const names: string[] = [];
    for (const { spec, clause } of runtimeImports(components)) {
      if (!isPackage(spec, ENGINES)) continue;
      const fallback = /^\s*(\w+)/.exec(clause.replace(/\{[\s\S]*\}/, ''));
      if (fallback?.[1]) names.push(fallback[1]);
      for (const named of clause.match(/\{([\s\S]*)\}/)?.[1]?.split(',') ?? []) {
        const local = named.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim();
        if (local) names.push(local);
      }
    }
    const press = region(components, 'Press');
    const outside = components.replace(press, '').replace(/^import[^;]*from 'react-native-(?:reanimated|worklets)';$/gm, '');
    const leaked = names.filter((name) => new RegExp(`\\b${name}\\b`).test(outside));
    assert.deepEqual(leaked, [], `components.tsx uses the engine outside Press:\n${leaked.join('\n')}`);

    // Exact, both ways: a file that starts on the legacy module fails, and so
    // does one that has left it while its name stays here, because a list that
    // only shrinks must shrink when a file moves, or the room it leaves is a
    // place the next legacy animation can hide.
    const legacy = FILES.filter((f) => usesLegacyAnimated(f.body)).map((f) => f.short);
    const added = legacy.filter((short) => !LEGACY_ANIMATED.includes(short));
    const left = LEGACY_ANIMATED.filter((short) => !legacy.includes(short));
    assert.deepEqual(
      [...legacy].sort(),
      [...LEGACY_ANIMATED].sort(),
      `The legacy Animated list is not the files on it. New motion goes through the engine's primitives; a file that moved comes off the list.\nStarted: ${added.join(', ') || 'none'}\nLeft: ${left.join(', ') || 'none'}`,
    );
  });

  test('the tab bar is still: no wash, no lift, no animation', () => {
    const bar = file('nav/LuvaniTabBar.tsx');
    assert.doesNotMatch(bar.body, /\bAnimated\b|useReduceMotion|interpolate/, 'the tab bar animates again');
    assert.equal(importsEngine(bar.body), false, 'the tab bar imports the engine');
    // Come alive (F737): the selected icon pops once, and that movement lives
    // in TabGlyph, not the bar. It watches reduced motion live, never loops,
    // and moves only transform and opacity.
    const glyph = file('nav/TabGlyph.tsx').body;
    assert.match(glyph, /const reduced = useReduceMotion\(\);/, 'TabGlyph does not watch reduced motion');
    assert.doesNotMatch(glyph, /\bwithRepeat\b|(?<![.\w])repeat\(/, 'TabGlyph loops');
    for (const m of every(glyph, /\buseAnimatedStyle\(/g)) {
      const body = callBody(glyph, m.index + 'useAnimatedStyle'.length);
      for (const key of every(body, /[{,]\s*(\w+)\s*:/g)) {
        assert.ok(['transform', 'opacity', 'translateY', 'scale'].includes(key[1]!), `TabGlyph animates ${key[1]}`);
      }
    }
  });

  test('the draw-in has one set of numbers, in motion.ts', () => {
    const offenders = FILES.filter(({ short, body }) => short !== 'motion.ts' && /\bDRAW_MS\s*=/.test(body)).map((f) => f.short);
    assert.deepEqual(offenders, [], 'the draw-in duration is written outside motion.ts');
    assert.match(file('motion.ts').body, /export const DRAW_MS = \d+;/, 'the draw-in has no named duration');
  });
});

/**
 * Reduced motion is the live answer, everywhere — F721.
 *
 * Reanimated samples the system setting once, when its module loads. Left to
 * its defaults, a learner who turns Reduce Motion on mid-session would go on
 * being animated at until the next launch, which is exactly the bug motion.ts
 * was written to end for the legacy module. So the engine is never asked:
 * the bridge at the root tells it the live answer, and every call through
 * drive.ts passes that answer explicitly.
 */
describe('reduced motion is watched, never sampled — F721', () => {
  test('nothing asks Reanimated for the system reduce-motion setting', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (/\buseReducedMotion\b/.test(f.body)) offenders.push(`${f.short}  useReducedMotion samples the setting at load`);
      if (/\bReduceMotion\.System\b/.test(f.body)) offenders.push(`${f.short}  ReduceMotion.System defers to the sampled setting`);
      if (/\bReducedMotionConfig\b/.test(f.body) && f.short !== 'motion/ReduceMotionBridge.tsx') {
        offenders.push(`${f.short}  ReducedMotionConfig outside the bridge`);
      }
      // A layout animation left to its default follows the sampled setting too.
      if (importsEngine(f.body) && /\b(?:entering|exiting|layout)=\{/.test(f.body) && !/\.reduceMotion\(/.test(f.body)) {
        offenders.push(`${f.short}  a layout animation with no .reduceMotion(...)`);
      }
    }
    assert.deepEqual(offenders, [], `Reanimated is left to its own reduce-motion answer:\n${offenders.join('\n')}`);

    // The belt: one bridge, driven by the live hook, mounted once at the root.
    const bridge = file('motion/ReduceMotionBridge.tsx').body;
    assert.match(bridge, /const reduced = useReduceMotion\(\);/, 'the bridge does not read the live answer');
    assert.match(
      bridge,
      /<ReducedMotionConfig mode=\{reduced \? ReduceMotion\.Always : ReduceMotion\.Never\} \/>/,
      'the bridge does not hand the live answer to the engine',
    );
    const app = stripComments(readFileSync(join(APP, 'App.tsx'), 'utf8'));
    assert.match(app, /import \{ ReduceMotionBridge \} from '\.\/src\/motion\/ReduceMotionBridge\.tsx';/, 'App.tsx does not import the bridge');
    assert.equal((app.match(/<ReduceMotionBridge \/>/g) ?? []).length, 1, 'the bridge is not mounted exactly once at the root');

    // The braces: every engine call in drive.ts is handed the live answer.
    const drive = file('motion/drive.ts').body;
    assert.match(
      drive,
      /function mode\(reduced: boolean\): ReduceMotion \{\s*return reduced \? ReduceMotion\.Always : ReduceMotion\.Never;\s*\}/,
      'drive.ts no longer turns the live answer into Always or Never',
    );
    const calls = [...every(drive, /\bwith(?:Timing|Spring|Delay|Sequence|Repeat|Decay)\(/g)];
    assert.ok(calls.length >= 5, 'drive.ts makes no engine calls, so this check reads nothing');
    for (const call of calls) {
      const body = callBody(drive, call.index + call[0].length - 1);
      assert.match(body, /\bmode\(reduced\)/, `drive.ts:${lineOf(drive, call.index)} starts an animation without the live reduced answer`);
    }
    for (const m of every(drive, /export function (\w+)\(([^)]*)\)/g)) {
      const fn = region(drive, m[1]!);
      if (/\bwith\w+\(/.test(fn)) assert.match(m[2]!, /\breduced: boolean\b/, `drive.ts ${m[1]} starts an animation without taking reduced`);
    }
  });

  test('every file that moves reads reduced motion from motion.ts', () => {
    const moving = FILES.filter((f) => importsEngine(f.body) || usesLegacyAnimated(f.body)).map((f) => f.short);
    // The walk has to be reading something: the press and the bridge are on the engine.
    for (const must of ['components.tsx', 'motion/ReduceMotionBridge.tsx', 'motion/drive.ts']) {
      assert.ok(moving.includes(must), `${must} does not move, so this check reads less than it should`);
    }
    const offenders: string[] = [];
    for (const short of moving) {
      if (NO_HOOK_NEEDED.includes(short)) continue;
      const { body } = file(short);
      const hook = /\buseReduceMotion\(/.test(body);
      const handed = /\breduced\??\s*:\s*boolean\b/.test(body);
      const sharedOnboarding = /import \{[^}]*\buseOnboardingTransition\b[^}]*\} from '(?:\.\.\/)*(?:\.\/)?(?:onboarding\/)?OnboardingLayout\.tsx';/.test(body) && /\buseOnboardingTransition\(\)/.test(body);
      if (!hook && !handed && !sharedOnboarding) {
        offenders.push(`${short}  moves without asking useReduceMotion() or being handed reduced`);
        continue;
      }
      if (hook && short !== 'motion.ts' && !/import \{[^}]*\buseReduceMotion\b[^}]*\} from '(?:\.\.\/)*(?:\.\/)?motion\.ts';/.test(body)) {
        offenders.push(`${short}  calls a useReduceMotion that is not motion.ts's`);
      }
    }
    // One subscription to the OS setting, and it is motion.ts's.
    for (const f of FILES) {
      if (f.short === 'motion.ts') continue;
      if (/isReduceMotionEnabled|['"]reduceMotionChanged['"]/.test(f.body)) offenders.push(`${f.short}  asks the OS itself`);
    }
    assert.deepEqual(offenders, [], `Movement that does not watch the live reduced-motion answer:\n${offenders.join('\n')}`);
  });
});

describe('one door to the engine', () => {
  test('timing calls go through motion/drive.ts, and every spring is a named token', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      if (f.short === 'motion/drive.ts') continue;
      for (const m of every(f.body, /\bwith(?:Timing|Spring|Delay|Sequence|Repeat|Decay)\(/g)) {
        offenders.push(`${f.short}:${lineOf(f.body, m.index)}  ${m[0]}`);
      }
    }
    for (const f of FILES) {
      for (const m of every(f.body, /(?<![.\w])spring\(/g)) {
        if (f.short === 'motion/drive.ts' && /function\s+$/.test(f.body.slice(Math.max(0, m.index - 9), m.index))) continue;
        const args = topArgs(callBody(f.body, m.index + 'spring'.length));
        if (!/^SPRING\.\w+$/.test(args[1] ?? '')) offenders.push(`${f.short}:${lineOf(f.body, m.index)}  spring(${args.join(', ')})`);
      }
    }
    assert.deepEqual(offenders, [], `The engine is reached around drive.ts, or a spring is written by hand:\n${offenders.join('\n')}`);
  });

  test('a loop runs only where it can be paused', () => {
    // A loop that cannot stop runs behind whatever the learner is doing for the
    // rest of the session. Only the orb, a busy button and a held icon state may
    // loop, and each of those files listens for what pauses it.
    const loops: string[] = [];
    for (const f of FILES) {
      if (f.short === 'motion/drive.ts') continue;
      const found = /\bAnimated\.loop\(/.test(f.body) ||
        [...every(f.body, /(?<![.\w])repeat\(/g)].some((m) => {
          const count = topArgs(callBody(f.body, m.index + 'repeat'.length))[1] ?? '';
          return /^-\s*\d|Infinity/.test(count);
        });
      if (found) loops.push(f.short);
    }
    const offenders = loops.filter((short) => !loopAllowed(short));
    assert.deepEqual(offenders, [], `A loop outside the orb, the busy button and the held icons:\n${offenders.join('\n')}`);
    const deaf = loops.filter((short) => !/paused|playing|active|useIsFocused|AppState/.test(file(short).body));
    assert.deepEqual(deaf, [], `A loop that nothing can pause:\n${deaf.join('\n')}`);
    assert.ok(loops.includes('tutor/VoiceOrb.tsx'), 'the orb no longer loops, so this check reads nothing');
  });

  test('the selected press is a pop and a blue ring layer, never a shadow', () => {
    // D7: buttons stay flat with richer motion. A tile presses deeper, and a
    // choice that becomes the chosen one pops once and wears a translucent blue
    // ring layer. F569 still holds: the ring is a view, not a cast shadow.
    const press = region(file('components.tsx').body, 'Press');
    assert.match(press, /depth\?: 'control' \| 'tile'|depth = 'control'/, 'the press has no tile depth');
    assert.match(press, /pressTo\(scale, depth === 'tile' \? PRESS_SCALE_TILE : PRESS_SCALE, reduced\)/, 'a tile does not press deeper than a control');
    assert.match(press, /if \(now\) selectPop\(scale, reduced\);/, 'becoming chosen does not pop');
    assert.match(press, /ringTo\(ring, now, reduced\);/, 'the ring does not follow the choice');
    assert.match(press, /\{selected !== undefined \? \(/, 'an action that is not a choice draws a ring');
    assert.match(press, /\{\.\.\.decorative\}\s*style=\{\[\{ pointerEvents: 'none',/, 'the ring is announced or catches touches');
    assert.match(press, /backgroundColor: colour\.blue/, 'the ring is not the brand blue');
    assert.match(press, /top: -space\(1\), right: -space\(1\), bottom: -space\(1\), left: -space\(1\)/, 'the ring does not sit four points around the surface');
    assert.doesNotMatch(press, /shadow|elevation/i, 'the press casts a shadow');
    assert.doesNotMatch(press, /\bwith(?:Timing|Spring|Sequence)\(/, 'the press reaches the engine around drive.ts');

    const motion = file('motion.ts').body;
    const pop = region(motion, 'selectPop');
    assert.match(pop, /if \(reduced\) \{\s*value\.value = 1;\s*return;\s*\}/, 'reduced motion does not leave a chosen tile at rest');
    assert.match(pop, /sequence\(reduced, timing\(SELECT_POP, SELECT_POP_MS, EASE\.out, reduced\), spring\(1, SPRING\.pop, reduced\)\)/, 'the pop is not up to SELECT_POP and home on the pop spring');
    const ring = region(motion, 'ringTo');
    assert.match(ring, /const to = on \? SELECT_RING_OPACITY : 0;/, 'the ring does not rest at its token opacity');
    assert.match(ring, /if \(reduced\) \{\s*value\.value = to;\s*return;\s*\}/, 'reduced motion does not show the ring at once');
  });

  test('no test loads a module that imports an animation, audio or haptics engine', () => {
    // node --test loads .ts files only, and a suite whose import graph reaches
    // a native module fails to load and takes its tests with it. So a test may
    // read such a file as text, but never import it, however indirectly.
    const tests = sourceFiles(SRC, true).filter((path) => /\.test\.tsx?$/.test(path));
    assert.ok(tests.length > 50, 'the test walk found almost nothing, so this check reads nothing');
    const found = new Map<string, string[]>();
    const reaches = (path: string, visiting: Set<string>): string[] | null => {
      const known = found.get(path);
      if (known) return known;
      if (visiting.has(path) || !existsSync(path)) return null;
      visiting.add(path);
      const body = stripComments(readFileSync(path, 'utf8'));
      for (const { spec } of runtimeImports(body)) {
        let trail: string[] | null = null;
        if (isPackage(spec, UNLOADABLE)) trail = [shortOf(path), spec];
        else if (spec.startsWith('.')) {
          const deeper = reaches(resolve(dirname(path), spec), visiting);
          if (deeper) trail = [shortOf(path), ...deeper];
        }
        if (trail) {
          found.set(path, trail);
          return trail;
        }
      }
      return null;
    };
    const offenders = tests
      .map((path) => reaches(path, new Set()))
      .filter((trail): trail is string[] => trail !== null)
      .map((trail) => trail.join(' -> '));
    assert.deepEqual(offenders, [], `A test reaches a module Node cannot load:\n${offenders.join('\n')}`);
  });
});
