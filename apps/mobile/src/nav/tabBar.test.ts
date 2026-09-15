/**
 * The bottom bar at the largest reading sizes — F583, closing F461.
 *
 * F461 was filed off a screenshot at AX5: "My French" and "Profile" ran into
 * each other because five cells sharing the bar by flex let a long word borrow
 * room from a short one until there was none left. The fix is not a cap of any
 * kind, so the thing this test mostly does is prove the caps are still absent.
 *
 * Read as source, because there is no renderer in this workspace
 * (docs/TESTING.md). The ceiling is honest: it proves the bar asks the reading
 * size and lays its cells out from the answer, never that a phone drew two
 * whole words side by side. P8-2 in the device runbook is where that is settled.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const BAR = stripComments(read('./LuvaniTabBar.tsx'));
/** One line, so a regex about an expression reads code and not the wrapping. */
const FLAT = BAR.replace(/\s+/g, ' ');

describe('the bottom bar keeps every whole word at the largest reading size — F583', () => {
  test('the tab bar labels wrap without colliding at the largest reading size', () => {
    // The bar has to know the reading size before it can lay out differently
    // for it, and PixelRatio is the one that reports the OS setting itself.
    assert.match(
      FLAT,
      /PixelRatio\.getFontScale\(\)/,
      'the bar never asks how big the words are, so the AX5 layout is the same layout as the default one',
    );
    assert.match(
      FLAT,
      /const wrapped = labelsWrapUnderGlyph\(PixelRatio\.getFontScale\(\)\)/,
      'the reading size is read but nothing is decided from it',
    );
    assert.match(
      FLAT,
      /function labelsWrapUnderGlyph\(fontScale: number\): boolean \{ return fontScale >= WRAPS_UNDER_GLYPH; \}/,
      'the threshold is decided inline rather than by one named rule, so the bar and this test can drift apart',
    );
    assert.match(FLAT, /const WRAPS_UNDER_GLYPH = 1\.6;/, 'the wrapping threshold moved off 1.6 without a word about why');

    // And the large branch is a width per cell, not a cap on the word.
    assert.match(
      FLAT,
      /wrapped && st\.cellWrapped/,
      'the cells never take the wrapped layout, so the rule is decided and then thrown away',
    );
    const from = BAR.indexOf('cellWrapped: {');
    assert.notEqual(from, -1, 'the wrapped cell style is gone; this test is reading the wrong thing');
    const cell = BAR.slice(from, BAR.indexOf('},', from) + 1);
    assert.match(cell, /flexBasis: '20%'/, 'a wrapped cell does not take a fifth of the bar, so the five cells share it again');
    assert.match(cell, /flexGrow: 0/, 'a wrapped cell can still grow into its neighbour');
    assert.match(cell, /flexShrink: 0/, 'a wrapped cell can still be shrunk out of its fifth by a longer neighbour');

    // The floor under every cell is still a floor: a two-line word makes the
    // cell taller, and nothing here is allowed to make it shorter.
    assert.match(FLAT, /minHeight: HIT \+ space\(6\)/, 'the cell no longer keeps a height floor at the touch target');

    // The whole of F313's rule, restated because this is the change most likely
    // to reach for one of them: no word is shortened, scaled or clipped to fit.
    for (const cap of ['numberOfLines', 'maxWidth', 'adjustsFontSizeToFit', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(
        !BAR.includes(cap),
        `the tab bar caps its label with ${cap}; at the largest reading size a word must wrap and the bar grow to hold it`,
      );
    }
  });

  test('a tab still says which one it is, and announces itself when the screen behind it changes', () => {
    // The layout change is the only change: every signal F313 and F325 put on
    // this bar is read back here, because a cell restyled without them is a bar
    // a screen reader cannot use.
    assert.match(FLAT, /accessibilityState=\{\{ selected: focused \}\}/, 'a screen reader is not told which tab is selected');
    assert.match(
      FLAT,
      /if \(!focused && !event\.defaultPrevented\) \{ navigation\.navigate\(route\.name as never\); announceTab\(route\.name\); \}/,
      'a tap on the tab you are already on announces a move that did not happen',
    );
    assert.match(
      FLAT,
      /color=\{focused \? accent\.primary : paper\.inkFaint\}/,
      'the active tab glyph is no longer set in the identity violet',
    );
    assert.match(
      FLAT,
      /focused \? \{ color: accent\.primary, fontFamily: type\.button\.fontFamily \}/,
      'the active tab label is no longer the identity violet at the heavier weight',
    );
    assert.match(FLAT, /\{ color: paper\.inkSoft \}/, 'the inactive tab label is no longer soft ink');
    assert.ok(!/\bst\.dot\b/.test(BAR), 'the bar marks the active cell with a dot again');
  });
});
