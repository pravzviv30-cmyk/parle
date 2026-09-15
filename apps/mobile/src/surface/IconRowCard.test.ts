/**
 * The white row card, read as source — F569.
 *
 * The tinted row's quiet sibling: the same shape for the things that belong to
 * no place. What is worth pinning is that it is ONE target, it says itself once
 * to a screen reader, and its mark is the touch floor wide.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const ROW = stripComments(read('./IconRowCard.tsx'));
const FLAT = ROW.replace(/\s+/g, ' ');

describe('the white row that opens somewhere — F569', () => {
  test('the whole row is one button that names itself once, never a chevron with a card around it', () => {
    // A row whose only target is its arrow is F545 wearing white, and a button
    // nested inside a button is invalid markup on the web.
    assert.equal((ROW.match(/<Pressable/g) ?? []).length, 1, 'the white row is not exactly one target');
    assert.match(FLAT, /accessibilityRole="button"/, 'the row does not announce itself as a button');
    assert.match(FLAT, /accessibilityLabel=\{accessibilityLabel\}/, 'the row does not say the one thing the caller asked it to say');
    assert.match(FLAT, /accessibilityLabel: string;/, 'the name is optional, so a row can reach a screen reader as two loose lines');
    assert.match(FLAT, /<ChevronRight color=\{paper\.inkFaint\} \/>/, 'the row no longer ends in the faint chevron that says it opens');
  });

  test('the mark is the touch floor wide and the disc swaps surfaces so it can be seen on white', () => {
    // On a white card a white disc is invisible, so the ground and the card
    // trade places. `DISC` is the token, never 44 written out.
    assert.match(FLAT, /width: DISC, height: DISC, borderRadius: DISC \/ 2, backgroundColor: paper\.ground/, 'the disc is not a DISC-wide circle of ground');
    assert.ok(!ROW.includes('backgroundColor: paper.card'), 'the disc is white on a white card, so it cannot be seen at all');
    assert.match(FLAT, /<Label>\{label\}<\/Label>/, 'the row lost its caps label');
    assert.match(FLAT, /type\.bodyStrong, \{ color: paper\.ink \}/, "the row's sentence is not the ink line the revamp gave it");

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!ROW.includes(raw), `the row writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(ROW, /#[0-9A-Fa-f]{6}/, 'the row writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!ROW.includes(clip), `the row uses ${clip}, so a learner who turns the text up loses words`);
    }
  });
});
