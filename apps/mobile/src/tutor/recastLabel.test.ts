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
  // The chip reads recastView, which labels by recastLabel(kind) (tested below).
  assert.match(transcript, /const view = recastView\(\{ kind, better, betterEn, reason \}, \{ latest \}\);/);
  assert.match(transcript, /<Label>\{view\.label\}<\/Label>/);
  assert.doesNotMatch(transcript, /<Label>A more natural way<\/Label>/);
});

test('recastView gives the transcript and the margin note the same words', async () => {
  const { recastView } = await import('./recastLabel.ts');
  const { authoredCorrectionReason } = await import('@luvani/core');
  const view = recastView({ kind: 'grammar-slip', better: 'Je voudrais un café', betterEn: 'I would like a coffee' }, { latest: true });
  assert.deepEqual(view, { label: 'Small fix', better: 'Je voudrais un café', betterEn: 'I would like a coffee', reason: null, latest: true });
  assert.equal(recastView({ better: 'a', betterEn: 'b' }, { latest: false }).label, 'A more natural way');
  assert.equal(recastView({ better: 'a', betterEn: 'b' }, { latest: false }).latest, false);
  const source = readFileSync(new URL('./Transcript.tsx', import.meta.url), 'utf8');
  assert.match(source, /recastView\(/, 'the transcript reads its recast from recastView');
  const { CORRECTION_REASONS } = await import('@luvani/core');
  const id = Object.keys(CORRECTION_REASONS)[0] as keyof typeof CORRECTION_REASONS;
  assert.equal(recastView({ better: 'a', betterEn: 'b', reason: id }, { latest: false }).reason, authoredCorrectionReason(id));
});
