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
        if (!/useNativeDriver:\s*true/.test(body)) {
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

  test('nothing bounces', () => {
    const offenders = FILES.filter((f) => /Animated\.spring\(/.test(f.body)).map((f) => f.short);
    assert.deepEqual(
      offenders,
      [],
      `DESIGN.md: "one continuous loop plus one settling entrance; nothing bounces".\n${offenders.join('\n')}`,
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
    const offenders = scenes
      .filter((f) => !f.body.includes('decorative') && !/from '\.\.\/pen\.tsx'/.test(f.body))
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
