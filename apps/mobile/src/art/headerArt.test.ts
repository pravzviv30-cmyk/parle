/**
 * The corner art, and the two things about it that can be decided in a test.
 *
 * `HeaderArt.tsx` reaches react-native and so cannot be imported here; the
 * decisions it makes were lifted into `headerArt.ts` for exactly that reason.
 * What is checked is what a learner would feel: at a big reading size the
 * picture leaves rather than the words shrinking, and the bleed off the corner
 * stays on the theme's grid instead of becoming two numbers somebody nudged.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEADER_ART_OFFSET, LONG_HEADER_ART_TOP, showHeaderArt } from './headerArt.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

describe('the header corner as the reading size grows — F570', () => {
  test('a learner who turns the text up loses the picture and never the greeting', () => {
    for (const scale of [1, 1.15, 1.25, 1.35, 1.49]) {
      assert.equal(showHeaderArt(scale), true, `the corner art hides at ${scale}, where the greeting still fits beside it`);
    }
    for (const scale of [1.5, 1.6, 2, 3.1]) {
      assert.equal(
        showHeaderArt(scale),
        false,
        `at ${scale} the greeting grows into the corner and the art is still drawn under it`,
      );
    }
  });

  test('the picture hangs off the corner on the same grid every other space is on', () => {
    const theme = readFileSync(join(HERE, '..', 'theme.ts'), 'utf8');
    const grid = /export const space = \(n: number\) => n \* (\d+)/.exec(theme);
    assert.ok(grid, 'theme.ts no longer spells the grid this way; this test is reading the wrong thing');
    const step = Number(grid[1]);

    assert.equal(HEADER_ART_OFFSET.top, -4 * step, 'the bleed upward is no longer four steps of the grid');
    assert.equal(HEADER_ART_OFFSET.right, -5 * step, 'the bleed sideways no longer matches the screen padding');
    assert.equal(LONG_HEADER_ART_TOP, -20 * step, 'the two-line headers no longer clear their purpose line');

    // The fade is painted into the PNG's alpha rather than masked at the edge:
    // a gradient over a negative margin clips hard on Android, and on the web
    // the overhang becomes real scrollable width.
    const corner = readFileSync(join(HERE, 'HeaderArt.tsx'), 'utf8');
    assert.ok(corner.includes("position: 'absolute'"), 'the corner art is in the flow, so it pushes the greeting down');
    assert.match(corner, /name === 'header-practice' \|\| name === 'header-myfrench'/, 'long tab titles no longer tuck their art above the purpose line');
    assert.ok(corner.includes('pointerEvents="none"'), 'the corner art can take a tap meant for the header');
    assert.ok(corner.includes('{...decorative}'), 'the corner art reaches a screen reader');
    assert.ok(
      !/LinearGradient|MaskedView/.test(corner),
      'the corner art masks its own fade, which clips on Android; the fade belongs in the PNG',
    );
  });
});
