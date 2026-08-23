import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COMPLETIONS_PER_MISSION } from './store.ts';

const source = readFileSync(fileURLToPath(new URL('./store.ts', import.meta.url)), 'utf8');

describe('mission completion history', () => {
  test('keeps prior finishes so best independence and repeat count remain evidence', () => {
    const writer = source.slice(source.indexOf('export function recordMissionCompletion'));
    assert.doesNotMatch(writer, /existing\.filter\(\(c\) => c\.id !== id\), \{ id, at, rung \}/);
    assert.match(writer, /existing\.filter\(\(c\) => c\.id === id\)/);
    assert.match(writer, /slice\(-COMPLETIONS_PER_MISSION\)/);
  });

  test('bounds the retained history', () => {
    assert.equal(COMPLETIONS_PER_MISSION, 20);
  });
});
