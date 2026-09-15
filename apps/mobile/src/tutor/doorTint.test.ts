/**
 * Every way in has one tint, and no two ways in share one — F573.
 *
 * Three doors, three tints. A fourth entry mode arriving without a tint is a
 * compile error on the Record; two doors on one paper is what this test is for,
 * because that is the failure a reader cannot see in a diff and a learner reads
 * as "these two are the same thing".
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { tint } from '../palette.ts';
import { ENTRY_MODE_KEYS } from './gate.ts';
import { CONTINUITY_TINT, DOOR_TINT, doorTint } from './doorTint.ts';

describe('the tint under each way into the tutor — F573', () => {
  test('every way into the tutor sits on one tint the palette ships, and no two share it', () => {
    const used = new Set<string>();
    for (const key of ENTRY_MODE_KEYS) {
      const name = doorTint(key);
      assert.ok(name in tint, `the ${key} door sits on ${name}, which is not a tint in the palette`);
      assert.equal(used.has(name), false, `the ${key} door shares its paper with another way in`);
      used.add(name);
    }
    assert.deepEqual(
      Object.keys(DOOR_TINT).sort(),
      [...ENTRY_MODE_KEYS].sort(),
      'the table names a door the tutor does not open, or misses one it does',
    );
    assert.ok(CONTINUITY_TINT in tint, `the remembers row sits on ${CONTINUITY_TINT}, which is not a tint in the palette`);
  });

  test('the table names a tint and never a colour', () => {
    // The hex is reachable from four files only (palette.test.ts). A role table
    // that spelled one would be the fifth, and the rule would have to widen to
    // let it through rather than because the design changed.
    const body = readFileSync(fileURLToPath(new URL('./doorTint.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(body, /#[0-9a-fA-F]{6}\b/, 'the door table writes a raw colour instead of naming a tint');
  });
});
