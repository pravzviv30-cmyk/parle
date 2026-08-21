import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_DISCUSSED_DATES,
  MAX_STORED_TOPICS,
  STAGGER_DUE_NOW,
  mergeTopics,
  phraseKeyOf,
  staggerNewCards,
  topicId,
  type PracticeTopic,
} from './topics.ts';
import { newCard } from '../review/scheduler.ts';

const DAY = 24 * 60 * 60 * 1000;

describe('topic identity', () => {
  test('ids are stable across casing, accents and stray spaces', () => {
    assert.equal(topicId('Ordering at the café'), 'topic:ordering-at-the-cafe');
    assert.equal(topicId('  ordering at the CAFE '), 'topic:ordering-at-the-cafe');
  });

  test('the phrase key matches how the review store banks a spoken line', () => {
    assert.equal(phraseKeyOf('  Un café, s’il vous plaît '), 'phrase:un café, s’il vous plaît');
  });
});

describe('mergeTopics', () => {
  const cafe = (): PracticeTopic => ({
    id: 'topic:ordering-at-the-cafe',
    title: { fr: 'Au café', en: 'Ordering at the café' },
    discussed: ['2026-08-19'],
    phraseKeys: ['phrase:ça marche'],
  });

  test('a new topic appends at the end with its sitting recorded', () => {
    const merged = mergeTopics([cafe()], [{ title: { fr: 'Le rugby', en: 'Rugby' }, phraseKeys: ['phrase:allez'] }], '2026-08-20');
    assert.equal(merged.length, 2);
    assert.equal(merged[1]!.id, 'topic:rugby');
    assert.deepEqual(merged[1]!.discussed, ['2026-08-20']);
  });

  test('a returning topic keeps its place, gains new phrases, counts the sitting once', () => {
    const merged = mergeTopics(
      [cafe()],
      [{ title: { fr: 'Au café', en: 'ordering at the cafe' }, phraseKeys: ['phrase:ça marche', 'phrase:sur place'] }],
      '2026-08-20',
    );
    assert.equal(merged.length, 1, 'same topic, not a second card');
    assert.deepEqual(merged[0]!.phraseKeys, ['phrase:ça marche', 'phrase:sur place']);
    assert.deepEqual(merged[0]!.discussed, ['2026-08-19', '2026-08-20']);
  });

  test('the same session never records two dates on one topic', () => {
    const once = mergeTopics([cafe()], [{ title: cafe().title, phraseKeys: [] }], '2026-08-19');
    assert.deepEqual(once[0]!.discussed, ['2026-08-19']);
  });

  test('discussion history caps; the oldest dates age out', () => {
    let topics: PracticeTopic[] = [cafe()];
    for (let day = 1; day <= MAX_DISCUSSED_DATES + 3; day += 1) {
      topics = mergeTopics(topics, [{ title: cafe().title, phraseKeys: [] }], `2026-09-${String(day).padStart(2, '0')}`);
    }
    assert.equal(topics[0]!.discussed.length, MAX_DISCUSSED_DATES);
    assert.equal(topics[0]!.discussed.at(-1), '2026-09-13');
  });

  test('an empty title is dropped, not stored as topic:', () => {
    const merged = mergeTopics([], [{ title: { fr: '', en: '   ' }, phraseKeys: ['phrase:x'] }], '2026-08-20');
    assert.deepEqual(merged, []);
  });

  test('the practice path keeps a useful recent window instead of growing forever', () => {
    let topics: PracticeTopic[] = [];
    for (let index = 0; index < MAX_STORED_TOPICS + 5; index += 1) {
      topics = mergeTopics(
        topics,
        [{ title: { fr: `Sujet ${index}`, en: `Topic ${index}` }, phraseKeys: [`phrase:${index}`] }],
        '2026-08-20',
      );
    }
    assert.equal(topics.length, MAX_STORED_TOPICS);
    assert.equal(topics[0]!.id, 'topic:topic-5');
    assert.equal(topics.at(-1)!.id, `topic:topic-${MAX_STORED_TOPICS + 4}`);
  });

  test('does not mutate its inputs', () => {
    const before = cafe();
    mergeTopics([before], [{ title: before.title, phraseKeys: ['phrase:new'] }], '2026-08-20');
    assert.deepEqual(before.phraseKeys, ['phrase:ça marche']);
    assert.deepEqual(before.discussed, ['2026-08-19']);
  });
});

describe('staggerNewCards', () => {
  const card = (fr: string) => newCard({ id: phraseKeyOf(fr), kind: 'vocab', front: fr, back: 'x', context: '', ipa: '' }, 1_000);

  test('the first few stay due now; the rest wait a day', () => {
    const staggered = staggerNewCards([card('a'), card('b'), card('c'), card('d'), card('e')], 1_000);
    assert.deepEqual(
      staggered.map((c) => c.due),
      [1_000, 1_000, 1_000, 1_000 + DAY, 1_000 + DAY],
    );
    assert.equal(STAGGER_DUE_NOW, 3);
  });

  test('a small batch is untouched', () => {
    const staggered = staggerNewCards([card('a'), card('b')], 1_000);
    assert.ok(staggered.every((c) => c.due === 1_000));
  });
});
