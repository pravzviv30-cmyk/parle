/**
 * The rhythm panel names a tint, and the tint is one the palette ships — F576.
 *
 * One value, and the two ways it can go wrong are both worth a tripwire: a name
 * that is not a tint at all, which typechecks the moment somebody widens the
 * type, and a hex typed in here, which would make this the fifth file that can
 * reach a colour.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { tint } from '../palette.ts';
import { RHYTHM_TINT } from './rhythmTint.ts';

describe('the tint under the speaking rhythm — F576', () => {
  test('the speaking rhythm sits on one tint the palette ships, named and not spelled', () => {
    assert.ok(RHYTHM_TINT in tint, `the rhythm panel sits on ${RHYTHM_TINT}, which is not a tint in the palette`);
    const body = readFileSync(fileURLToPath(new URL('./rhythmTint.ts', import.meta.url)), 'utf8');
    assert.doesNotMatch(body, /#[0-9a-fA-F]{6}\b/, 'the rhythm tint is written as a raw colour instead of named');
  });
});
