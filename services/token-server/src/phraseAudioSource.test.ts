import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack } from '@luvani/core';
import { resolvePhraseAudioManifestSource } from './phraseAudioSource.ts';
const pack = buildConversationPack({ id: '01234567-89ab-4def-8123-456789abcdef', sessionId: '01234567-89ab-4def-8123-456789abcdef',
  learnerId: 'owner', createdAt: '2026-10-02T12:00:00Z', title: { fr: 'Au café', en: 'At the café' }, summary: 'An order.',
  keyPhrases: [{ fr: 'Un café, merci.', frWritten: null, en: 'A coffee, thanks.' }],
  corrections: [{ quote: 'Je suis vingt ans.', better: 'J’ai vingt ans.', betterEn: 'I’m twenty.', why: 'Use avoir for age.' }] });
const row = { payload: pack, state: 'ready', session_id: pack.id };
const proof = { session_id: pack.id, user_id: pack.learnerId };
function requestOver(rows: unknown[], calls: string[] = [], next: () => void = () => {}) {
  return async (url: string | URL | Request) => { calls.push(String(url)); next(); return Response.json(rows.shift()); };
}
test('saved audio manifests select exact curated French from an owned ready completed pack, never posted deck text', async () => {
  for (const [kind, french] of [['phrase', 'Un café, merci.'], ['correction', 'J’ai vingt ans.']] as const) {
    const calls: string[] = [];
    assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind, index: 0 },
      requestOver([[row], [proof]], calls)), french);
    assert.match(calls[0]!, /user_id=eq.owner&state=eq.ready&select=payload,state,session_id&limit=1/);
    assert.match(calls[1]!, /session_usage\?session_id=eq\.[0-9a-f-]+&user_id=eq.owner/);
    assert.ok(calls.every(url => !url.includes('café') && !url.includes('vingt')), 'words never enter a URL');
  }
});
test('a row/payload state disagreement, foreign owner or identity, missing phrase or missing completion authorizes no audio', async () => {
  for (const invalid of [{ ...row, state: 'generating' }, { ...row, payload: { ...pack, state: 'archived' } },
    { ...row, payload: { ...pack, learnerId: 'other' } }, { ...row, session_id: 'other' },
    { ...row, payload: { ...pack, id: 'other' } }, { payload: { audio: 'not a curated pack' }, state: 'ready', session_id: pack.id }]) {
    assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
      requestOver([[invalid], [proof]])), null);
  }
  for (const missing of [[], [{ ...proof, user_id: 'other' }], [{ ...proof, session_id: 'other' }]]) {
    assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
      requestOver([[row], missing])), null);
  }
  assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 63 },
    requestOver([[row], [proof]])), null);
});
test('an invalid or cancelled source starts no read, and cancellation between source and proof returns no French', async () => {
  const aborted = new AbortController(); aborted.abort(); const calls: string[] = [];
  assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
    requestOver([[row], [proof]], calls), aborted.signal), null); assert.equal(calls.length, 0);
  assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: 'arbitrary-card', kind: 'phrase', index: 0 },
    requestOver([[row]], calls)), null); assert.equal(calls.length, 0);
  const controller = new AbortController();
  assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
    requestOver([[row]], calls, () => controller.abort()), controller.signal), null); assert.equal(calls.length, 1);
});
test('an unavailable source or completion store fails closed, without synthesizing a fallback sentence', async () => {
  await assert.rejects(resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
    async () => new Response(null, { status: 503 })), /unavailable/);
});

test('a valid uppercase saved-audio locator resolves its canonical owned pack', async () => {
  const calls: string[] = [];
  assert.equal(await resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id.toUpperCase(), kind: 'phrase', index: 0 },
    requestOver([[row], [proof]], calls)), pack.keyPhrases[0]!.fr);
  assert.ok(calls.every(url => url.includes(pack.id)), 'queries use the canonical UUID');
});

test('a caller-cancelled saved-audio lookup still has a database deadline', async () => {
  const caller = new AbortController(); let observed: AbortSignal | undefined;
  const holdOpen = setTimeout(() => {}, 50);
  try {
    await assert.rejects(resolvePhraseAudioManifestSource('https://db.invalid', 'service-test', 'owner', { packId: pack.id, kind: 'phrase', index: 0 },
      async (_url, init) => { observed = init?.signal as AbortSignal; return new Promise((_resolve, reject) => {
        observed!.addEventListener('abort', () => reject(observed!.reason), { once: true });
      }); }, caller.signal, 5), error => error instanceof Error && error.name === 'TimeoutError');
    assert.equal(observed?.aborted, true); assert.equal(caller.signal.aborted, false, 'a deadline does not mutate its caller');
  } finally { clearTimeout(holdOpen); }
});
