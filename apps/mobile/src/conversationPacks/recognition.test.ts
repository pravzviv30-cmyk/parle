import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { choicesFor, matchPair, pairsFor, shuffled, matchingOrder, checkRecognition, NEW_ATTEMPT } from './recognition.ts';

const pack = buildConversationPack({
  id: 'one', sessionId: 'one', learnerId: 'learner', createdAt: '2026-09-20T12:00:00Z',
  title: { fr: 'Au café', en: 'At a café' }, summary: 'You ordered coffee.',
  keyPhrases: [
    { fr: 'Un café', en: 'A coffee', frWritten: null },
    { fr: 'Merci', en: 'Thanks', frWritten: null },
    { fr: 'Salut', en: 'Hello', frWritten: null },
  ],
});

test('recognition reveals only after two failed checks, never after the first', () => {
  const first = checkRecognition(NEW_ATTEMPT, false);
  assert.deepEqual(first, { misses: 1, outcome: 'retry' });
  const second = checkRecognition(first, false);
  assert.deepEqual(second, { misses: 2, outcome: 'revealed' });
  assert.equal(checkRecognition(second, false), second, 'completed questions ignore extra checks');
  assert.deepEqual(NEW_ATTEMPT, { misses: 0, outcome: 'waiting' }, 'each next question starts fresh');
});

test('correct recognition never requires an extra attempt or counts as a miss', () => {
  assert.deepEqual(checkRecognition(NEW_ATTEMPT, true), { misses: 0, outcome: 'correct' });
  const recovered = checkRecognition(checkRecognition(NEW_ATTEMPT, false), true);
  assert.deepEqual(recovered, { misses: 1, outcome: 'correct' });
  assert.equal(checkRecognition(recovered, false), recovered);
});

test('matching includes only grounded unique phrase/meaning pairs', () => {
  const pairs = pairsFor({ ...pack, keyPhrases: [...pack.keyPhrases, { fr: 'Bonjour', en: 'Hello', frWritten: null }] });
  assert.equal(pairs.length, 3);
  assert.equal(matchPair(pairs, pairs[0]!.key, pairs[0]!.key), true);
  assert.equal(matchPair(pairs, pairs[0]!.key, pairs[1]!.key), false);
  assert.equal(matchPair(pairs, 'not-in-pack', 'not-in-pack'), false);
  for (let i = 0; i < 30; i++) assert.ok(matchingOrder(pairs, String(i)).every((p, j) => p.key !== pairs[j]?.key));
  assert.deepEqual(pairsFor({ ...pack, keyPhrases: [] }), []);
});

test('listening has one correct grounded meaning, stable shuffled choices and no fabricated distractors', () => {
  const choices = choicesFor(pack);
  assert.equal(choices.length, 2);
  assert.deepEqual(choices, choicesFor(pack));
  for (const c of choices) {
    assert.equal(c.options[c.correctIndex], c.phrase.en);
    assert.equal(c.options.filter((o) => o === c.phrase.en).length, 1);
    assert.ok(c.options.every((o) => pack.keyPhrases.some((p) => p.en === o)));
  }
  assert.deepEqual(choicesFor({ ...pack, keyPhrases: pack.keyPhrases.slice(0, 1) }), []);
  const values = [1, 2, 3, 4];
  assert.deepEqual([...shuffled(values, 'a')].sort(), values);
  assert.deepEqual(values, [1, 2, 3, 4]);
});
