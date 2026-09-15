/**
 * Every kind of practice has one tint, and no two share one — F574.
 *
 * Three rows, three papers. Two of them on one paper would read to a learner as
 * one thing said twice, which is the whole reason the mapping is a table in a
 * file rather than a colour typed into a row.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { tint } from '../palette.ts';
import { MADE_FROM_TINT, madeFromTint, type MadeFromKey } from './madeFromTint.ts';

describe('the tint under each kind of practice — F574', () => {
  test('every kind of practice sits on one tint the palette ships, and no two share it', () => {
    const kinds: readonly MadeFromKey[] = ['replay', 'phrase', 'sound'];
    assert.deepEqual(
      Object.keys(MADE_FROM_TINT).sort(),
      [...kinds].sort(),
      'the table names a kind of practice the tab does not draw, or misses one it does',
    );
    const used = new Set<string>();
    for (const kind of kinds) {
      const name = madeFromTint(kind);
      assert.ok(name in tint, `${kind} sits on ${name}, which is not a tint in the palette`);
      assert.equal(used.has(name), false, `${kind} shares its paper with another kind of practice`);
      used.add(name);
    }
  });

  test('the table names a tint and never a colour', () => {
    const body = readFileSync(fileURLToPath(new URL('./madeFromTint.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(body, /#[0-9a-fA-F]{6}\b/, 'the practice table writes a raw colour instead of naming a tint');
  });
});
