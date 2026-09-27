/**
 * The tokens revamp A added, held to the source — F569.
 *
 * `theme.ts` imports `Platform`, and the mobile test runner is
 * `node --test --experimental-strip-types` with no react-native, which is the
 * whole reason `palette.ts` exists one level below it. So this suite reads
 * theme.ts as text the way `palette.test.ts` already does for the hex rule, and
 * asserts on the four tokens the revamp turns on: the two corner radii, the one
 * named shadow, the hero title, and the white disc inside a tinted row.
 *
 * Reading text rather than importing is not a weaker test here. What can go
 * wrong with a design token is that somebody writes a number where a name
 * belongs, and a number in the source is exactly what text can see.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  test('Atelier corners distinguish cards from compact rows', () => {
    // The lived-in mockup's cards are broad and its rows are tighter, and the two
    // shapes have to differ or a tinted row reads as a small card. Both are
    // names rather than numbers at the call site: a screen writes
    // `radius.card`, never a 24.
    // 2026-09-27, notebook Phase 1: the one Card turns 16, per the design
    // contract. The row radius stays as a token while TintRow is a deprecated
    // wrapper; nothing new draws at it.
    const radius = block(themeSource(), 'export const radius = {', '} as const;');
    assert.match(radius, /\bcard: 16,/, 'the one Card no longer turns the notebook corner of 16');
    assert.match(radius, /\brow: 8,/, 'there is no radius for a tinted row, so a row will be drawn at the card radius');
    assert.match(radius, /\bpill: 999,/, 'the primary pill is no longer fully rounded like the logo');
  });

  test('the theme exports no shadow token or retired whisper alias', () => {
    assert.doesNotMatch(themeSource(), /export\s+const\s+shadow\b|\bwhisper\s*:/);
  });

  test('UI type is DM Sans Medium, and the French hero is larger than any heading', () => {
    // 2026-09-27, notebook Phase 1: Fraunces is for French only. The four UI
    // heads move to DM Sans Medium at the contract's sizes, and the French hero
    // is always larger than any heading on the screen it leads.
    const scale = block(themeSource(), 'export const type = {', '} as const;');
    const size = (name: string, family: string): { fontSize: number; lineHeight: number } => {
      const m = new RegExp(`\\b${name}: \\{ fontFamily: font\\.${family}, fontSize: (\\d+(?:\\.\\d+)?), lineHeight: (\\d+)`).exec(scale);
      assert.ok(m, `${name} is not set in font.${family}`);
      return { fontSize: Number(m[1]), lineHeight: Number(m[2]) };
    };
    assert.deepEqual(size('display', 'sansMedium'), { fontSize: 28, lineHeight: 34 }, 'display is not DM Sans Medium 28/34');
    assert.deepEqual(size('title', 'sansMedium'), { fontSize: 22, lineHeight: 28 }, 'title is not DM Sans Medium 22/28');
    assert.deepEqual(size('cardTitle', 'sansMedium'), { fontSize: 20, lineHeight: 26 }, 'cardTitle is not DM Sans Medium 20/26');
    assert.deepEqual(size('heading', 'sansMedium'), { fontSize: 17, lineHeight: 22 }, 'heading is not DM Sans Medium 17/22');
    const hero = size('frenchHero', 'serif');
    assert.deepEqual(hero, { fontSize: 34, lineHeight: 42 }, 'the French hero is not Fraunces 34/42');
    assert.ok(hero.fontSize > size('display', 'sansMedium').fontSize, 'the French hero is not larger than the display');

    // The fit steps for a long line: 34, 30, 26. Each still out-sizes every UI
    // head a card can carry. Raw sizes may only live in this file.
    const fit = block(themeSource(), 'export const heroFit = {', '} as const;');
    const steps = [...fit.matchAll(/fontFamily: font\.serif, fontSize: (\d+), lineHeight: (\d+)/g)].map((m) => Number(m[1]));
    assert.deepEqual(steps, [30, 26], 'the French hero no longer steps 34, 30, 26 by length');
    for (const step of steps) {
      for (const head of ['title', 'cardTitle', 'heading'] as const) {
        assert.ok(step > size(head, 'sansMedium').fontSize, `a fitted French hero at ${step} is not larger than ${head}`);
      }
    }

    // And the serif belongs to French. Every style in the scale set in Fraunces
    // is a French style by name.
    for (const m of scale.matchAll(/^\s{2}(\w+): \{ fontFamily: font\.(serif|serifBold)\b/gm)) {
      assert.match(m[1]!, /^french/, `${m[1]} is set in Fraunces and is not French`);
    }
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
