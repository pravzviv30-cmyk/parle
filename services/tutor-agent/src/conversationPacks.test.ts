import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildConversationPack } from '@luvani/core';
import { reportConversationPack } from './conversationPacks.ts';

const pack = buildConversationPack({
  id: '01234567-89ab-4def-8123-456789abcdef',
  sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'learner-1',
  createdAt: '2026-09-04T12:00:00.000Z',
  title: { fr: 'Au café', en: 'At the cafe' },
  summary: 'You ordered a coffee.',
  keyPhrases: [{ fr: 'Un café, s’il vous plaît.', frWritten: null, en: 'A coffee, please.' }],
});

test('Conversation Pack delivery retries a transient response and uses the agent proof', async () => {
  let attempts = 0;
  let request: RequestInit | undefined;
  await reportConversationPack(pack, {
    tokenServer: 'https://token.example',
    agentSecret: 'agent-secret',
    sleep: async () => undefined,
    request: async (_url, init) => {
      attempts += 1;
      request = init;
      return new Response('{}', { status: attempts === 1 ? 503 : 200 });
    },
  });
  assert.equal(attempts, 2);
  assert.equal((request?.headers as Record<string, string>)['x-luvani-agent'], 'agent-secret');
  assert.deepEqual(JSON.parse(String(request?.body)), { userId: pack.learnerId, sessionId: pack.sessionId, pack, phase: 'final' });
});

test('baseline delivery explicitly requests durable recovery', async () => {
  await reportConversationPack(pack, {phase:'baseline',request:async(_url,init)=>{
    assert.equal(JSON.parse(String(init?.body)).phase,'baseline');
    return new Response('{}');
  }});
});
