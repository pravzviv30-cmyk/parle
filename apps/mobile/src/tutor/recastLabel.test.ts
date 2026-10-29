/**
 * The chip under a learner's line names what kind of fix it is (founder,
 * 2026-10-29): a grammar fix is a small fix; everything else is a more
 * natural way to say it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { recastLabel } from './recastLabel.ts';

const read = (r: string): string => readFileSync(new URL(r, import.meta.url), 'utf8');

test('a grammar fix under the learner\'s line says Small fix', () => {
  assert.equal(recastLabel('grammar-slip'), 'Small fix');
  for (const kind of ['textbook-phrasing', 'register', 'anglicism', 'english-to-french', 'blocking-error', undefined, '', 'something-new']) {
    assert.equal(recastLabel(kind), 'A more natural way', `${String(kind)} lost its label`);
  }
  // The kind rides from the coach item onto the recast, and the chip reads it.
  assert.match(read('../live/useLiveSession.ts'), /quote: c\.quote,\s*kind: c\.kind,/);
  const transcript = read('./Transcript.tsx');
  assert.match(transcript, /<Label>\{recastLabel\(kind\)\}<\/Label>/);
  assert.doesNotMatch(transcript, /<Label>A more natural way<\/Label>/);
});
