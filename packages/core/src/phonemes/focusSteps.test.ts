import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DRILLS, getDrill } from './drills.ts';
import { focusDrillSteps } from './focusSteps.ts';
import type { Drill } from './drills.ts';

const bare = (over: Partial<Drill> = {}): Drill => ({
  id: 'test',
  kind: 'articulation',
  target: 'y',
  title: 'a drill',
  why: 'because',
  durationSec: 60,
  ...over,
});

describe('focusDrillSteps — the drill behind the end card', () => {
  test('the focus drill plays every pair and every item exactly once', () => {
    // Run over the real bank rather than a fixture: this is the sequence a
    // learner actually gets, and a drill that quietly dropped half its words
    // would still look fine on any hand-built example.
    for (const drill of DRILLS) {
      const steps = focusDrillSteps(drill);
      const expected = (drill.pairs?.length ?? 0) * 2 + (drill.items?.length ?? 0);
      assert.equal(steps.length, expected, `${drill.id} plays both halves of every pair and every item`);

      const words = steps.map((s) => s.word);
      assert.equal(new Set(words).size, words.length, `${drill.id} says no word twice`);

      const inDrill = [
        ...(drill.pairs ?? []).flatMap((p) => [p.a.word, p.b.word]),
        ...(drill.items ?? []).map((i) => i.word),
      ];
      assert.deepEqual([...words].sort(), [...inDrill].sort(), `${drill.id} plays exactly what it contains`);
    }
  });

  test('a focus drill with no material offers nothing to start', () => {
    // The end card must not open a player onto an empty screen. Nothing to
    // play is an answer the caller can act on.
    assert.deepEqual(focusDrillSteps(bare()), []);
    assert.deepEqual(focusDrillSteps(bare({ pairs: [], items: [] })), []);
  });

  test('each half of a pair carries the other, so the contrast is on screen while it is said', () => {
    const drill = getDrill('y-vs-u');
    assert.ok(drill, 'the bank still has the vowel pair drill');
    const steps = focusDrillSteps(drill);
    const [first, second] = steps;
    assert.ok(first && second);
    assert.equal(first.contrast?.word, second.word, 'the first word is set against the second');
    assert.equal(second.contrast?.word, first.word, 'and the second against the first');
    assert.ok(first.contrast?.gloss, 'the meaning travels with it, because the meaning is the point');
  });

  test('a standalone item has nothing to be told apart from, and says so', () => {
    const steps = focusDrillSteps(bare({ items: [{ word: 'rue', ipa: 'ʁy', gloss: 'street' }] }));
    assert.equal(steps.length, 1);
    assert.equal(steps[0]!.contrast, null);
  });

  test('pairs come before items, so the reason arrives before the exercise', () => {
    const steps = focusDrillSteps(
      bare({
        pairs: [{ a: { word: 'rue', ipa: 'ʁy', gloss: 'street' }, b: { word: 'roue', ipa: 'ʁu', gloss: 'wheel' } }],
        items: [{ word: 'tu', ipa: 'ty', gloss: 'you' }],
      }),
    );
    assert.deepEqual(steps.map((s) => s.word), ['rue', 'roue', 'tu']);
  });
});
