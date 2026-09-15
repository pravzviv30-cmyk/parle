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
  test('a card corner is twenty and a row corner is sixteen', () => {
    // The mockup's cards are generous and its rows are tighter, and the two
    // shapes have to differ or a tinted row reads as a small card. Both are
    // names rather than numbers at the call site: a screen writes
    // `radius.card`, never a 20.
    const radius = block(themeSource(), 'export const radius = {', '} as const;');
    assert.match(radius, /\bcard: 20,/, 'a white card no longer turns the corner the mockup draws');
    assert.match(radius, /\brow: 16,/, 'there is no radius for a tinted row, so a row will be drawn at the card radius');
  });

  test('the whisper is the ink token thinned, never a hex', () => {
    // One soft shadow under a white card, and the live microphone's glow. The
    // colour is the ink TOKEN: a shadow written as a hex here would be the first
    // raw colour outside palette.ts and would take F320 with it.
    const whisper = block(themeSource(), 'export const shadow = {', '} as const;');
    assert.match(whisper, /\bwhisper: \{/, 'the one named shadow is gone, so a card will grow its own numbers');
    assert.match(whisper, /shadowColor: paper\.ink/, 'the whisper is not the ink token, so its colour escaped the palette');
    assert.doesNotMatch(whisper, /#[0-9a-fA-F]{6}\b/, 'the whisper writes a raw colour');
    for (const number of ['shadowOffset', 'shadowOpacity', 'shadowRadius', 'elevation']) {
      assert.ok(whisper.includes(number), `the whisper carries no ${number}, so it renders on one platform only`);
    }
    // Exactly one shadow lives here. A second named shadow is how an app ends
    // up with four of them, each a little deeper than the last.
    assert.equal(
      (whisper.match(/^\s{2}\w+: \{$/gm) ?? []).length,
      1,
      'the theme names more than one shadow; there is the whisper and the live mic glow, and nothing else',
    );
  });

  test('the hero title is the bold serif one size under the display', () => {
    // The card that leads a tab is a headline, not a screen title, so it is the
    // bold Fraunces a step down from `display`. Raw sizes may only live in this
    // object, which is why the hero cannot simply write a 22 where it is drawn.
    const scale = block(themeSource(), 'export const type = {', '} as const;');
    assert.match(
      scale,
      /cardTitle: \{ fontFamily: font\.serifBold, fontSize: 22, lineHeight: 28 \}/,
      'the hero title is not the bold serif at 22 over 28',
    );
    assert.match(scale, /display: \{ fontFamily: font\.serifBold, fontSize: 32/, 'the display is no longer the bold serif above it');
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
