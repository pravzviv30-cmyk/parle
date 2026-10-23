import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { LiveScoring } from './liveScoring.ts';

describe('the shared live scorer', () => {
  test('never asks for more scores than the reviewed envelope', async () => {
    let asked = 0;
    const scoring = new LiveScoring({ maxScores: 2, scorer: async () => { asked += 1; return [{ ipa: 'ʁ', score: 30, word: 'rue' }]; } });
    for (let i = 0; i < 5; i += 1) scoring.score(Buffer.from('x'), 'la rue');
    await scoring.settle({ skip: false });
    assert.equal(asked, 2);
    assert.equal(scoring.scoredCount, 2);
  });

  test('a score landing after it closed is dropped, and nothing more is asked', async () => {
    let release: () => void = () => {};
    const landed = new Promise<void>((resolve) => { release = resolve; });
    let asked = 0;
    const scoring = new LiveScoring({ scorer: async () => { asked += 1; await landed; return [{ ipa: 'ʁ', score: 30, word: 'rue' }]; } });
    scoring.score(Buffer.from('x'), 'la rue');
    await scoring.settle({ skip: true });
    release();
    await landed;
    await new Promise((resolve) => setImmediate(resolve));
    scoring.score(Buffer.from('x'), 'la rue');
    assert.equal(scoring.utterances.length, 0);
    assert.equal(asked, 1);
  });
});
