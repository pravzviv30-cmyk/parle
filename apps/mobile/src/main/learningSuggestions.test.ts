import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learningSuggestions } from './learningSuggestions.ts';
import { explorePhrases, exploreMissions, exploreTopicSeed } from './exploreCatalogue.ts';
const choices = { level: null, confidence: null, focus: null } as const;
test('all four stated abilities change the pitch without claiming an earned level', () => {
  const zero = learningSuggestions({ ...choices, level: 'zero' });
  const few = learningSuggestions({ ...choices, level: 'few' });
  const getby = learningSuggestions({ ...choices, level: 'getby' });
  const confident = learningSuggestions({ ...choices, level: 'confident' });
  assert.match(zero.ideas[0]!.title, /Order/); assert.match(few.ideas[0]!.title, /plan/);
  assert.equal(getby.preferredTier, 2); assert.equal(confident.preferredTier, 3);
  assert.match(confident.ideas[0]!.en, /nuance/);
  assert.ok(!/bonjour|hello/i.test(confident.homeBody));
  assert.equal(learningSuggestions(choices).preferredTier, 1);
  assert.equal(learningSuggestions({ ...choices, level: 'zero' }, 3).preferredTier, 3, 'self-report cannot erase the earned catalogue pitch');
});
test('confidence changes support independently from challenge and focus changes the practice door', () => {
  const hesitant = learningSuggestions({ level: 'confident', confidence: 'hesitant', focus: 'listening' });
  const comfortable = learningSuggestions({ level: 'confident', confidence: 'comfortable', focus: 'words' });
  assert.deepEqual(hesitant.ideas.map(({en, ...idea}) => idea), comfortable.ideas.map(({en, ...idea}) => idea));
  assert.match(hesitant.ideas[0]!.en, /Offer an example/); assert.match(comfortable.ideas[0]!.en, /Let me try first/);
  assert.match(hesitant.support, /example/); assert.match(comfortable.support, /French first/);
  assert.notEqual(hesitant.focusTitle, comfortable.focusTitle);
});
test('tier ordering keeps complete search results and leaves the authored catalogue intact', () => {
  const original = explorePhrases('', null);
  for (const tier of [1, 2, 3] as const) {
    const ordered = explorePhrases('', null, tier);
    assert.equal(ordered.length, original.length); assert.equal(ordered[0]!.tier, tier);
    assert.deepEqual(new Set(ordered.map(x => x.id)), new Set(original.map(x => x.id)));
  }
  assert.equal(explorePhrases('cafe', null, 3).length, explorePhrases('café', null).length);
  assert.deepEqual(explorePhrases('', null), original);
  assert.ok(exploreMissions('', null).every(m => m.cefr === 'A0' || m.cefr === 'A1' || m.cefr === 'A2'));
});

test('every complete preference combination fits the existing signed topic protocol', () => {
  for (const level of [null, 'zero', 'few', 'getby', 'confident'] as const)
    for (const confidence of [null, 'hesitant', 'trying', 'comfortable'] as const)
      for (const focus of [null, 'listening', 'words', 'speaking'] as const) {
        const result = learningSuggestions({level, confidence, focus});
        for (const seed of [...result.ideas, ...(result.freeSeed ? [result.freeSeed] : [])]) {
          assert.ok(seed.fr.length > 0 && seed.fr.length <= 120, seed.fr);
          assert.ok(seed.en.length > 0 && seed.en.length <= 120, seed.en);
        }
      }
});

test('short searches start the requested topic while longer searches stay complete', () => {
  assert.match(exploreTopicSeed('a job interview', null)!.en, /a job interview/);
  assert.equal(exploreTopicSeed('x'.repeat(91), null), null);
  assert.ok(exploreTopicSeed('x'.repeat(90), null)!.en.length <= 120);
  assert.match(exploreTopicSeed('', 'travel')!.en, /trip/);
  assert.equal(exploreTopicSeed('', null), null);
});
