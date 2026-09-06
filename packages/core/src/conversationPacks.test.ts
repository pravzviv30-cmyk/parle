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

/**
 * A Practice card wants two things the tutor already knew and threw away: how
 * long the learner spoke for, and what the conversation was about.
 */
const timedPackInput = {
  id: '01234567-89ab-4def-8123-456789abcdef',
  sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'learner-1',
  createdAt: '2026-09-04T12:00:00.000Z',
  title: { fr: 'Au café', en: 'At the cafe' },
  summary: 'You ordered a coffee.',
  keyPhrases: [phrase],
};

test('a pack carries how long the learner spoke and what the conversation covered', () => {
  const pack = buildConversationPack({
    ...timedPackInput,
    durationSec: 487,
    topics: [{ fr: 'Au café', en: 'At the cafe' }, { fr: 'Les croissants', en: 'Croissants' }],
  });

  assert.equal(pack.durationSec, 487);
  assert.deepEqual(pack.topics, [{ fr: 'Au café', en: 'At the cafe' }, { fr: 'Les croissants', en: 'Croissants' }]);
  assert.equal(isConversationPack(pack), true);

  // Through storage and back, because that is the only trip a pack ever makes.
  const stored: unknown = JSON.parse(JSON.stringify(pack));
  assert.equal(isConversationPack(stored), true);
  assert.deepEqual(stored, pack);
});

test('a pack stored before these fields existed is still a whole pack', () => {
  const pack = buildConversationPack(timedPackInput);
  assert.equal(pack.durationSec, null, 'a session nobody timed is not a session of no length');
  assert.deepEqual(pack.topics, []);

  // What an older build actually left in the table: neither key present.
  const older: Record<string, unknown> = { ...pack };
  delete older.durationSec;
  delete older.topics;
  assert.equal('durationSec' in older, false);
  assert.equal(isConversationPack(older), true, 'an older pack is still the learner’s conversation');
});

/**
 * The rule `apps/mobile/src/progress/momentum.ts` already settled for the goal
 * bar: nothing measured is not zero minutes spoken, and a card reading nought
 * over a real conversation is the app telling the learner it did not happen.
 */
test('an untimed or impossible duration stores null, never a nought', () => {
  const durations = [0, -1, -600, Number.NaN, Number.POSITIVE_INFINITY, undefined, null];
  for (const durationSec of durations) {
    const pack = buildConversationPack({ ...timedPackInput, durationSec });
    assert.equal(pack.durationSec, null, `${String(durationSec)} seconds is not a duration`);
    assert.equal(isConversationPack(pack), true);
  }
  assert.equal(buildConversationPack({ ...timedPackInput, durationSec: 0.4 }).durationSec, null);
  assert.equal(buildConversationPack({ ...timedPackInput, durationSec: 42.6 }).durationSec, 43);
});

test('topics are capped, and an empty or half-written topic never reaches a card', () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ fr: `Sujet ${index}`, en: `Topic ${index}` }));
  const pack = buildConversationPack({ ...timedPackInput, topics: many });
  assert.equal(pack.topics.length, 4);
  assert.deepEqual(pack.topics[0], { fr: 'Sujet 0', en: 'Topic 0' });

  const messy = buildConversationPack({
    ...timedPackInput,
    topics: [
      { fr: '  Au café  ', en: '  At the cafe  ' },
      { fr: 'Au café', en: 'At the cafe' },
      { fr: '', en: 'No French' },
      { fr: 'Pas d’anglais', en: '   ' },
    ],
  });
  assert.deepEqual(messy.topics, [{ fr: 'Au café', en: 'At the cafe' }], 'trimmed, deduplicated, and never half a pair');
});

test('a duration and a topic list are not speech, so the audio guard lets them through', () => {
  const pack = buildConversationPack({
    ...timedPackInput,
    durationSec: 487,
    topics: [{ fr: 'Au café', en: 'At the cafe' }],
  });
  // Named first, so this proves the guard walked the real fields rather than
  // an object that quietly never carried them.
  assert.equal(pack.durationSec, 487);
  assert.equal(pack.topics.length, 1);
  assert.equal(containsForbiddenConversationData(pack), false);
  assert.equal(isConversationPack(pack), true);

  // And the guard still bites through the new fields, not just around them.
  assert.equal(containsForbiddenConversationData({ ...pack, topics: [{ fr: 'x', en: 'y', transcript: 'private' }] }), true);
});
