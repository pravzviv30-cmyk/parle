/**
 * The tokens revamp A added, held to the source — F569. Revamp B's face, scale
 * and corners — F596.
 *
 * `theme.ts` imports `Platform`, and the mobile test runner is
 * `node --test --experimental-strip-types` with no react-native, which is the
 * whole reason `palette.ts` exists one level below it. So this suite reads
 * theme.ts as text the way `palette.test.ts` already does for the hex rule, and
 * asserts on the tokens the revamps turn on: the corner radii, the absent
 * shadow, the one face and its scale, and the white disc inside a row.
 *
 * Reading text rather than importing is not a weaker test here. What can go
 * wrong with a design token is that somebody writes a number where a name
 * belongs, and a number in the source is exactly what text can see.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('.', import.meta.url));

/** The theme with its comments gone, so a comment may say anything. */
function themeSource(): string {
  return readFileSync(join(SRC, 'theme.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The slice from one export marker up to the next. */
function block(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `${start} is missing from theme.ts`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} is missing from theme.ts`);
  return source.slice(from, to);
}

describe('the revamp tokens are named once, in the theme — F569', () => {
  test('B corners: card 24, feature 28, tile 20, field 16, pill 999, and the aliases point at them', () => {
    // Revamp B, STYLE section 8: a card turns 24, a feature card 28, a stat tile
    // 20 and a field 16, and a real button is a full capsule. Every one is a name
    // rather than a number at the call site: a screen writes `radius.card`, never
    // a 24. The four older names stay as aliases of the B value their screens
    // mean until those screens are redrawn: a row is a tile, and a chip, an
    // input and a control are a field.
    const radius = block(themeSource(), 'export const radius = {', '} as const;');
    assert.match(radius, /\bcard: 24,/, 'the one Card no longer turns the B corner of 24');
    assert.match(radius, /\bfeature: 28,/, 'a feature card no longer turns 28');
    assert.match(radius, /\btile: 20,/, 'a stat tile no longer turns 20');
    assert.match(radius, /\bstat: 18,/, 'the chunky Today stat tile no longer turns 18');
    assert.match(radius, /\bfield: 16,/, 'a field no longer turns 16');
    assert.match(radius, /\bpill: 999,/, 'the primary pill is no longer fully rounded like the logo');
    assert.match(radius, /\brow: 20,/, 'the row alias no longer points at the tile corner');
    assert.match(radius, /\bchip: 16,/, 'the chip alias no longer points at the field corner');
    assert.match(radius, /\binput: 16,/, 'the input alias no longer points at the field corner');
    assert.match(radius, /\bcontrol: 16,/, 'the control alias no longer points at the field corner');
  });

  test('the theme exports exactly one shadow token, the soft lift, and no whisper', () => {
    // DECISIONS.md, 2026-10-19 reverses the no-shadow rule for one soft lift
    // under illustrated Explore cards: y 12, blur 24, spread -16, ink at 0.45.
    const source = themeSource();
    assert.doesNotMatch(source, /\bwhisper\s*:/);
    const shadow = block(source, 'export const shadow = {', '} as const;');
    const entries = [...shadow.matchAll(/^\s{2}(\w+): \{/gm)].map((m) => m[1]);
    assert.deepEqual(entries, ['lift'], 'the theme carries a shadow other than the one soft lift');
    assert.match(shadow, /offsetX: 0, offsetY: 12, blur: 24, spread: -16, color: liftInk,/);
  });

  test('Outfit is the only face, at the STYLE scale, and every French style is Outfit SemiBold', () => {
    // Revamp B, STYLE section 3: one geometric sans for every word, French and
    // English alike, with no serif, no second sans and no italics. Weight and
    // size say what a line is. The old font names survive as aliases of an
    // Outfit cut so no screen has to change in the same stage as the face.
    const source = themeSource();
    const fonts = block(source, 'export const font = {', '} as const;');
    const cuts = [...fonts.matchAll(/^\s{2}(\w+): '([^']+)',$/gm)].map((m) => [m[1]!, m[2]!] as const);
    assert.equal(cuts.length, 6, `the font block names ${cuts.length} faces, expected only the six canonical cuts`);
    for (const [name, face] of cuts) {
      assert.match(face, /^Outfit-(Regular|Medium|SemiBold|Bold|ExtraBold|Black)$/, `font.${name} is ${face}, which is not an Outfit cut`);
    }
    const named = new Map(cuts);
    for (const [key, face] of [
      ['regular', 'Outfit-Regular'],
      ['medium', 'Outfit-Medium'],
      ['semiBold', 'Outfit-SemiBold'],
      ['bold', 'Outfit-Bold'],
      ['extraBold', 'Outfit-ExtraBold'],
    ] as const) {
      assert.equal(named.get(key), face, `font.${key} is not ${face}`);
    }
    assert.doesNotMatch(source, /Fraunces|DMSans|fontStyle|italic/i, 'the theme still names a retired face or sets a slant');

    // The scale, token by token: family, size, line height and tracking. A
    // token with no tracking in STYLE carries none here.
    const scale = block(source, 'export const type = {', '} as const;');
    const size = (name: string, family: string): { fontSize: number; lineHeight: number; letterSpacing?: number } => {
      const m = new RegExp(
        `\\b${name}: \\{ fontFamily: font\\.${family}, fontSize: (\\d+(?:\\.\\d+)?), lineHeight: (\\d+)(?:, letterSpacing: (-?\\d+(?:\\.\\d+)?))? \\}`,
      ).exec(scale);
      assert.ok(m, `${name} is not set in font.${family}`);
      const out: { fontSize: number; lineHeight: number; letterSpacing?: number } = { fontSize: Number(m[1]), lineHeight: Number(m[2]) };
      if (m[3] !== undefined) out.letterSpacing = Number(m[3]);
      return out;
    };
    const rows: [string, string, number, number, number?][] = [
      ['hero', 'extraBold', 112, 95, -4.5],
      // The main appearance roles the paywall and account screens use.
      ['mainDisplay', 'extraBold', 44, 48],
      ['mainHeading', 'semiBold', 22, 27],
      ['mainBody', 'regular', 17, 23],
      ['display', 'extraBold', 44, 44, -1.3],
      // DECISIONS.md, 2026-10-19: the screen title grows to 34/800, section
      // heads move to ExtraBold, and the eyebrow label joins the scale.
      ['title', 'extraBold', 34, 38, -0.6],
      ['eyebrow', 'bold', 13, 18],
      // Revamp B stage 2: the stat tile's number, SNIPPETS' 36/800. STYLE has
      // no 36, so it is a token rather than a raw size in the component.
      ['stat', 'extraBold', 36, 36, -0.7],
      ['heading', 'extraBold', 20, 25, -0.2],
      ['cardTitle', 'extraBold', 20, 25, -0.2],
      ['frenchHero', 'semiBold', 34, 42, -0.3],
      ['frenchLg', 'semiBold', 28, 34, -0.3],
      ['french', 'semiBold', 20, 26],
      ['frenchSm', 'semiBold', 17, 23],
      ['body', 'regular', 17, 25],
      ['bodyStrong', 'semiBold', 17, 25],
      ['label', 'semiBold', 16, 20],
      ['button', 'semiBold', 16, 20],
      ['small', 'medium', 14, 20],
      // B0 (2026-10-20): the compact stat, its caption and the lock badge's words.
      ['caption', 'medium', 12, 16],
      ['badge', 'bold', 12, 16],
      ['tabLabel', 'semiBold', 12, 12],
      ['notation', 'medium', 14, 20, 0.4],
    ];
    for (const [name, family, fontSize, lineHeight, letterSpacing] of rows) {
      const want = letterSpacing === undefined ? { fontSize, lineHeight } : { fontSize, lineHeight, letterSpacing };
      assert.deepEqual(size(name, family), want, `${name} is not Outfit ${family} ${fontSize}/${lineHeight}${letterSpacing === undefined ? '' : ` at ${letterSpacing}`}`);
    }
    assert.equal(
      [...scale.matchAll(/^\s{2}(\w+): \{/gm)].length,
      rows.length,
      'the scale gained or lost a token this test does not pin',
    );

    // The French line is always the largest text in its block.
    assert.ok(size('frenchLg', 'semiBold').fontSize > size('heading', 'extraBold').fontSize, 'the French line to say is not larger than a heading');
    const hero = size('frenchHero', 'semiBold').fontSize;
    // DECISIONS.md, 2026-10-19: the screen title is 34, the French hero's own
    // size, so the hero may match the title but never fall below it.
    assert.ok(hero >= size('title', 'extraBold').fontSize, 'the French hero is smaller than the screen title');
    assert.ok(hero > size('heading', 'extraBold').fontSize, 'the French hero is not larger than a heading');

    // The fit steps for a long line: 34, 30, 26. Each still out-sizes every head
    // a card carries. In B `title` is the screen title and a card never carries
    // it, so the steps are held above heading and cardTitle. Raw sizes may only
    // live in this file.
    const fit = block(source, 'export const heroFit = {', '} as const;');
    const steps = [...fit.matchAll(/fontFamily: font\.semiBold, fontSize: (\d+), lineHeight: (\d+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(steps, [30, 26], 'the French hero no longer steps 34, 30, 26 by length in Outfit SemiBold');
    for (const step of steps) {
      for (const head of ['heading', 'cardTitle'] as const) {
        assert.ok(step > size(head, 'extraBold').fontSize, `a fitted French hero at ${step} is not larger than ${head}`);
      }
    }

    // Every French style is Outfit SemiBold, and no style is set in caps.
    const french = [...scale.matchAll(/^\s{2}(french\w*): \{ fontFamily: font\.(\w+)\b/gm)];
    assert.equal(french.length, 4, `the scale has ${french.length} French styles, expected frenchHero, frenchLg, french and frenchSm`);
    for (const m of french) {
      assert.equal(m[2], 'semiBold', `${m[1]} is set in font.${m[2]}, not Outfit SemiBold`);
    }
    assert.doesNotMatch(scale, /textTransform/, 'a style in the scale is set in caps again');
  });

  test('the theme names the six Outfit cuts App.tsx loads, and the bundle carries no other face', () => {
    // A face the theme names and App.tsx does not load renders in the system
    // font with no error, and a file in the fonts folder nothing loads is weight
    // in the bundle. So the theme, the loader and the folder are read together.
    const app = readFileSync(join(SRC, '..', 'App.tsx'), 'utf8');
    const call = app.indexOf('useFonts({');
    assert.notEqual(call, -1, 'App.tsx no longer calls useFonts, so no face is loaded at all');
    const loader = app.slice(call, app.indexOf('});', call));
    const pairs = [...loader.matchAll(/'([\w-]+)': require\('\.\/assets\/fonts\/([\w-]+)\.ttf'\)/g)].map((m) => [m[1]!, m[2]!] as const);
    for (const [name, file] of pairs) {
      assert.equal(name, file, `App.tsx loads ${file}.ttf under the name ${name}, so the theme's name and the file disagree`);
    }
    const loaded = pairs.map(([name]) => name).sort();
    assert.deepEqual(
      loaded,
      ['Outfit-Black', 'Outfit-Bold', 'Outfit-ExtraBold', 'Outfit-Medium', 'Outfit-Regular', 'Outfit-SemiBold'],
      'App.tsx does not load exactly the six Outfit cuts',
    );

    // Dotfiles are the file system's, not the bundle's: nothing requires them.
    const folder = readdirSync(join(SRC, '..', 'assets', 'fonts'))
      .filter((f) => !f.startsWith('.'))
      .sort();
    assert.deepEqual(
      folder,
      ['OFL-Outfit.txt', 'Outfit-Black.ttf', 'Outfit-Bold.ttf', 'Outfit-ExtraBold.ttf', 'Outfit-Medium.ttf', 'Outfit-Regular.ttf', 'Outfit-SemiBold.ttf'],
      'the fonts folder carries a face nothing loads, or has lost one the loader needs, or its licence',
    );

    const fonts = block(themeSource(), 'export const font = {', '} as const;');
    const named = [...fonts.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]!);
    assert.ok(named.length >= 5, 'the font block names no faces, so this test is reading the wrong thing');
    for (const face of named) {
      assert.ok(loaded.includes(face), `the theme names ${face}, which App.tsx never loads, so it renders in the system font`);
    }
  });

  test('the one pen is ICONS.md\'s: STROKE is 2', () => {
    // Revamp B, F598. ICONS.md draws every mark at stroke-width 2 on a 24 box,
    // and the notebook's 2.2 was a hair heavier than every board the founder
    // approved. One token, so the glyphs, the orb's rings and the pen's scenes
    // move together; a second weight anywhere is what glyphs.test.ts refuses.
    assert.match(themeSource(), /export const STROKE = 2;/, 'the one stroke weight is not ICONS.md\'s 2');
  });

  test('the white disc inside a tinted row is the touch floor wide', () => {
    // The disc under a row's glyph was a 44 typed into `myfrench/SituationRow`.
    // It is a token now, and it is the same 44 as the touch floor on purpose: a
    // row's glyph reads at the size a finger would need, so the row never looks
    // smaller than it is.
    const source = themeSource();
    assert.match(source, /export const DISC = 44;/, 'the row disc is not a token, so every row will size its own');
    assert.match(source, /export const HIT = 44;/, 'the touch floor moved, and the disc no longer matches it');
  });
});
