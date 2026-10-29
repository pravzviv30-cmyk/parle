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
  assert.match(confident.ideas[0]!.brief, /nuance/);
  assert.ok(!/bonjour|hello/i.test(confident.homeBody));
  assert.equal(learningSuggestions(choices).preferredTier, 1);
  assert.equal(learningSuggestions({ ...choices, level: 'zero' }, 3).preferredTier, 3, 'self-report cannot erase the earned catalogue pitch');
});
test('confidence changes support independently from challenge and focus changes the practice door', () => {
  const hesitant = learningSuggestions({ level: 'confident', confidence: 'hesitant', focus: 'listening' });
  const comfortable = learningSuggestions({ level: 'confident', confidence: 'comfortable', focus: 'words' });
  assert.deepEqual(hesitant.ideas.map(({brief, ...idea}) => idea), comfortable.ideas.map(({brief, ...idea}) => idea));
  assert.match(hesitant.ideas[0]!.brief, /Offer an example/); assert.match(comfortable.ideas[0]!.brief, /Let me try first/);
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
  assert.ok(exploreMissions('', null).every(m => m.cefr === 'A0' || m.cefr === 'A1' || m.cefr === 'A2' || m.cefr === 'B1'));
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
  assert.match(exploreTopicSeed('', 'travel')!.brief!, /trip/);
  assert.equal(exploreTopicSeed('', null), null);
});

// F929: the seed's en/fr is the title the room shows and the tutor says
// ("{Title}. Let's talk about it."); instructions ride in the tutor-only brief.
test('free talk never shows prompt text in the transcript', () => {
  const instruction = /\b(me|my|I|ask|help|discuss|talk|explore|hints?|offer|let)\b|[.;:]/i;
  const seeds: { fr: string; en: string; brief?: string }[] = [];
  for (const level of [null, 'zero', 'few', 'getby', 'confident'] as const)
    for (const confidence of [null, 'hesitant', 'trying', 'comfortable'] as const)
      for (const focus of [null, 'listening', 'words', 'speaking'] as const) {
        const result = learningSuggestions({ level, confidence, focus });
        seeds.push(...result.ideas, ...(result.freeSeed ? [result.freeSeed] : []));
      }
  for (const topic of [null, 'food', 'friends', 'travel', 'work', 'shops', 'home', 'health', 'admin', 'out', 'culture'] as const) {
    const seed = exploreTopicSeed(topic === null ? 'a job interview' : '', topic);
    if (seed) seeds.push(seed);
  }
  for (const seed of seeds) {
    assert.ok(seed.en.length <= 40 && seed.fr.length <= 40, `"${seed.en}" / "${seed.fr}" is not a short title`);
    if (seed.en !== 'a job interview') assert.doesNotMatch(seed.en, instruction, `"${seed.en}" reads as an instruction`);
    assert.doesNotMatch(seed.fr, /[.;:]/, `"${seed.fr}" reads as a sentence`);
    assert.ok(seed.brief !== undefined && seed.brief.length > 0 && seed.brief.length <= 240, `"${seed.en}" carries no brief`);
  }
  // The brief carries what the title used to: the instruction and the support cue.
  const getby = learningSuggestions({ level: 'getby', confidence: 'hesitant', focus: 'speaking' });
  assert.equal(getby.ideas[0]!.en, 'Your day');
  assert.equal(getby.ideas[0]!.fr, 'Ta journée');
  assert.match(getby.ideas[0]!.brief, /Ask why things happened/);
  assert.match(getby.ideas[0]!.brief, /Offer an example/);
  assert.match(getby.freeSeed!.brief!, /Talk about anything\. I get by; connect my ideas\. Offer an example\. Help me speak\./);
  assert.equal(exploreTopicSeed('a job interview', null)!.en, 'a job interview');
  assert.match(exploreTopicSeed('a job interview', null)!.brief!, /Talk with me in French about: a job interview/);
});
