/**
 * The white row card, read as source — F569.
 *
 * 2026-09-27, notebook Phase 1: IconRowCard is a deprecated wrapper that draws
 * `LedgerRow`. The row keeps every promise it made (one target, named once,
 * the chevron that says it opens, words that grow), and those are held on
 * LedgerRow in components.test.ts. What is held here is that the wrapper only
 * forwards: no card around the row, no disc, no feature paper, no second target.
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
  test('the row is the ledger row, named once by the caller, and never a card with a button in it', () => {
    assert.match(
      FLAT,
      /<LedgerRow glyph=\{glyph\} label=\{label\} title=\{line\} note=\{note\} onPress=\{onPress\} accessibilityLabel=\{accessibilityLabel\} \/>/,
      'the wrapper does not hand every field to the ledger row',
    );
    assert.match(FLAT, /accessibilityLabel: string;/, 'the name is optional, so a row can reach a screen reader as two loose lines');
    assert.equal((ROW.match(/<Pressable/g) ?? []).length, 0, 'the wrapper grew its own target, so the row is two buttons');
    assert.doesNotMatch(ROW, /<Card\b|accent\.feature|DISC|backgroundColor/, 'the wrapper still draws a card, a disc or feature paper');

    for (const raw of ['fontSize', 'fontFamily', 'lineHeight']) {
      assert.ok(!ROW.includes(raw), `the row writes ${raw} itself; the type scale lives in theme.ts`);
    }
    assert.doesNotMatch(ROW, /#[0-9A-Fa-f]{6}/, 'the row writes a raw colour; every hex lives in palette.ts');
    for (const clip of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling']) {
      assert.ok(!ROW.includes(clip), `the row uses ${clip}, so a learner who turns the text up loses words`);
    }
  });
});
