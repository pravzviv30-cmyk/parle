import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildConversationPack,
  containsForbiddenConversationData,
  isConversationPack,
  translationExercisesFor,
  validateExercise,
} from './index.ts';

const phrase = { fr: "Bonjour, je m'appelle Luc.", frWritten: null, en: 'Hello, my name is Luc.' };

test('a fallback Conversation Pack always contains both translation directions', () => {
  const pack = buildConversationPack({
    id: '01234567-89ab-4def-8123-456789abcdef',
    sessionId: '01234567-89ab-4def-8123-456789abcdef',
    learnerId: 'learner-1',
    createdAt: '2026-09-04T12:00:00.000Z',
    title: { fr: 'À la boulangerie', en: 'At the bakery' },
    summary: 'You ordered bread politely.',
    keyPhrases: [phrase],
  });

  assert.equal(pack.state, 'ready');
  assert.deepEqual(
    pack.exercises.map((exercise) => exercise.kind === 'translate' ? exercise.direction : null),
    ['fr-en', 'en-fr'],
  );
  assert.ok(pack.exercises.every((exercise) => validateExercise(exercise).ok));
});

test('a claimed pack remains visibly generating until curation finishes', () => {
  const pack = buildConversationPack({
    id: '01234567-89ab-4def-8123-456789abcdef',
    sessionId: '01234567-89ab-4def-8123-456789abcdef',
    learnerId: 'learner-1',
    createdAt: '2026-09-04T12:00:00.000Z',
    state: 'generating',
    title: { fr: 'Au café', en: 'At the cafe' },
    summary: 'You ordered a coffee.',
    keyPhrases: [phrase],
  });
  assert.equal(pack.state, 'generating');
  assert.equal(isConversationPack(pack), true);
});

test('translation exercises retain a valid answer in the requested language', () => {
  const [frEn, enFr] = translationExercisesFor('pack-1', [phrase]);
  assert.deepEqual(frEn?.accepted, [phrase.en]);
  assert.deepEqual(enFr?.accepted, [phrase.fr]);
});

test('a Conversation Pack contract refuses raw audio and readable transcript fields', () => {
  const pack = buildConversationPack({
    id: '01234567-89ab-4def-8123-456789abcdef',
    sessionId: '01234567-89ab-4def-8123-456789abcdef',
    learnerId: 'learner-1',
    createdAt: '2026-09-04T12:00:00.000Z',
    title: { fr: 'Au café', en: 'At the cafe' },
    summary: 'You ordered a coffee.',
    keyPhrases: [phrase],
  });
  assert.equal(isConversationPack(pack), true);
  const withTranscript = { ...pack, transcript: 'private text' };
  assert.equal(containsForbiddenConversationData(withTranscript), true);
  assert.equal(isConversationPack(withTranscript), false);
  assert.equal(containsForbiddenConversationData({ nested: { rawAudio: 'bytes' } }), true);
});
