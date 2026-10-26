import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { buildConversationPack, type ConversationPack } from '@luvani/core';
import { PRACTICE_STATUS_COPY, packPracticeView, practiceStatusOf } from './practiceStatus.ts';
import { PAST_CONVERSATION_NOTE } from './packExercises.ts';

const base = buildConversationPack({
  id: 'p1', sessionId: 'p1', learnerId: 'u', createdAt: '2026-10-20T10:00:00Z',
  title: { fr: 'Au café', en: 'At the cafe' }, summary: 'Coffee.',
  keyPhrases: [{ fr: 'Un café', frWritten: null, en: 'A coffee' }],
});
const withStatus = (status: unknown, pack: ConversationPack = base) => ({ ...pack, practiceStatus: status }) as ConversationPack;
const empty = { ...base, keyPhrases: [], corrections: [] };

test('a pack with no practice status reads as ready, as older servers meant', () => {
  assert.equal(practiceStatusOf(base), 'ready');
  assert.deepEqual(packPracticeView(base), { status: 'ready', offersPractice: true, note: null, pending: null, listLine: null });
});

test('an unknown practice status reads as ready', () => {
  assert.equal(practiceStatusOf(withStatus('soon')), 'ready');
  assert.equal(practiceStatusOf(withStatus(3)), 'ready');
});

test('a ready status reads as ready', () => {
  assert.equal(packPracticeView(withStatus('ready')).note, null);
});

test('a preparing pack with phrases offers what exists and says more is coming', () => {
  const view = packPracticeView(withStatus('preparing'));
  assert.equal(view.status, 'preparing');
  assert.equal(view.offersPractice, true);
  assert.equal(view.note, 'More practice is on its way.');
  assert.equal(view.pending, null);
  assert.equal(view.listLine, 'Becoming practice');
});

test('a preparing pack with nothing to practise yet shows the pending card', () => {
  const view = packPracticeView(withStatus('preparing', empty));
  assert.equal(view.offersPractice, false);
  assert.equal(view.pending, 'Your conversation is becoming practice.');
});

test('an older generating pack still reads as preparing', () => {
  assert.equal(practiceStatusOf({ ...base, state: 'generating' }), 'preparing');
});

test('a failed pack says so calmly and still offers its phrases', () => {
  const view = packPracticeView(withStatus('failed'));
  assert.equal(view.status, 'failed');
  assert.equal(view.offersPractice, true);
  assert.equal(view.note, 'Practice for this one didn’t come together. Its phrases are ready to review.');
  assert.equal(view.pending, null);
});

test('a failed pack with no phrases does not claim phrases are ready', () => {
  const view = packPracticeView(withStatus('failed', empty));
  assert.equal(view.offersPractice, false);
  assert.doesNotMatch(view.note ?? '', /ready to review/);
});

test('the practice status and delete copy has no em dash and offers no retry', () => {
  const library = readFileSync(fileURLToPath(new URL('./ConversationPackLibrary.tsx', import.meta.url)), 'utf8');
  for (const line of [...Object.values(PRACTICE_STATUS_COPY), PAST_CONVERSATION_NOTE]) {
    assert.doesNotMatch(line, /—/);
    assert.doesNotMatch(line, /retry|try again/i);
  }
  assert.match(library, /They won’t show this conversation’s name\./);
  assert.doesNotMatch(library, /—/);
});
