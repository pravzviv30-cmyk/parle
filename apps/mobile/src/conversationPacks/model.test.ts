import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { latestReadyPack, orderedConversationPacks } from './model.ts';

function pack(id: string, createdAt: string, state: 'ready' | 'generating' = 'ready') {
  return buildConversationPack({
    id,
    sessionId: id,
    learnerId: 'learner-1',
    createdAt,
    state,
    title: { fr: 'Au café', en: 'At the cafe' },
    summary: 'You ordered a coffee.',
    keyPhrases: [{ fr: 'Un café, s’il vous plaît.', frWritten: null, en: 'A coffee, please.' }],
  });
}

test('Conversation Packs are newest first and duplicate sessions collapse', () => {
  const older = pack('00000000-0000-4000-8000-000000000001', '2026-09-03T12:00:00.000Z');
  const newer = pack('00000000-0000-4000-8000-000000000002', '2026-09-04T12:00:00.000Z');
  assert.deepEqual(orderedConversationPacks([older, newer, older]).map((entry) => entry.id), [newer.id, older.id]);
});

test('the continuation card waits for a ready Pack', () => {
  const pending = pack('00000000-0000-4000-8000-000000000001', '2026-09-04T12:00:00.000Z', 'generating');
  const ready = pack('00000000-0000-4000-8000-000000000002', '2026-09-03T12:00:00.000Z');
  assert.equal(latestReadyPack([pending, ready])?.id, ready.id);
});
