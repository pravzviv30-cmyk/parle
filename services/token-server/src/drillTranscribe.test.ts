import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleDrillTranscribe, type DrillTranscribeDeps } from './drillTranscribe.ts';
import { transcribeFrenchTake } from '../../shared/transcription.ts';

const audio = Buffer.from('RIFF0000WAVEtemporary-audio');
function request(body = audio, url = '/drill/transcribe', asserted = 'learner'): IncomingMessage {
  const req = Readable.from([body]) as unknown as IncomingMessage;
  req.url = url;
  req.headers = { authorization: 'Bearer test', 'x-luvani-user': asserted };
  return req;
}
function response() {
  let status = 0;
  let body = '';
  const res = Object.assign(new EventEmitter(), { writeHead(value: number) { status = value; }, end(value: string) { body = value; } }) as unknown as ServerResponse;
  return { res, status: () => status, body: () => JSON.parse(body) as Record<string, unknown> };
}
function dependencies() {
  const calls: (string | null)[] = [];
  let uploads = 0;
  const deps: DrillTranscribeDeps = {
    users: { resolve: async () => ({ ok: true, userId: 'learner' }) },
    limits: async (_req, _res, user) => { calls.push(user); return true; },
    transcribe: async () => { uploads++; return 'Je voudrais une table.'; },
  };
  return { deps, calls, uploads: () => uploads };
}

test('a transcription authenticates and limits before its one ephemeral upload', async () => {
  const d = dependencies();
  const r = response();
  await handleDrillTranscribe(request(), r.res, d.deps);
  assert.equal(r.status(), 200);
  assert.deepEqual(r.body(), { transcript: 'Je voudrais une table.' });
  assert.deepEqual(d.calls, [null, 'learner']);
  assert.equal(d.uploads(), 1);
});

test('refused identity, limits, query, mismatched owner and oversized audio never reach transcription', async () => {
  for (const scenario of ['auth', 'ip', 'user', 'query', 'owner', 'size', 'empty', 'header']) {
    const d = dependencies();
    if (scenario === 'auth') d.deps.users.resolve = async () => ({ ok: false, status: 401, message: 'sign in' });
    if (scenario === 'ip' || scenario === 'user') d.deps.limits = async (_req, res, user) => {
      if ((scenario === 'ip' && user === null) || (scenario === 'user' && user !== null)) {
        res.writeHead(429); res.end('{}'); return false;
      }
      return true;
    };
    const r = response();
    await handleDrillTranscribe(request(
      scenario === 'size' ? Buffer.alloc(2 * 1024 * 1024 + 1) : scenario === 'empty' ? Buffer.alloc(0) : audio,
      scenario === 'query' ? '/drill/transcribe?words=private' : '/drill/transcribe',
      scenario === 'owner' ? 'other' : scenario === 'header' ? '%' : 'learner',
    ), r.res, d.deps);
    assert.ok(r.status() >= 400, scenario);
    assert.equal(d.uploads(), 0, scenario);
    assert.ok(!JSON.stringify(r.body()).includes('private'));
  }
});

test('unavailable transcription returns no transcript or invented verdict', async () => {
  for (const throwing of [false, true]) {
    const d = dependencies();
    d.deps.transcribe = async () => { if (throwing) throw new Error('vendor'); return null; };
    const r = response();
    await handleDrillTranscribe(request(), r.res, d.deps);
    assert.equal(r.status(), 503);
    assert.deepEqual(Object.keys(r.body()), ['error']);
  }
});

test('French transcription sends bytes once without learner identifiers and bounds its reply', async () => {
  let calls = 0;
  const request: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://api.deepgram.com/v1/listen?model=nova-3&language=fr&smart_format=true&mip_opt_out=true');
    assert.equal(init?.body, audio);
    assert.deepEqual(init?.headers, { authorization: 'Token fake-test-key', 'content-type': 'audio/wav' });
    assert.ok(init?.signal);
    return Response.json({ results: { channels: [{ alternatives: [{ transcript: ' Je voudrais une table. ', confidence: 0.1 }] }] } });
  };
  assert.equal(await transcribeFrenchTake(audio, { key: 'fake-test-key', request }), 'Je voudrais une table.');
  assert.equal(calls, 1, 'recognition confidence is not a grade or a reason to retry a paid call');
  for (const payload of [null, {}, { results: { channels: [{ alternatives: [{ transcript: ' ' }] }] } }, { results: { channels: [{ alternatives: [{ transcript: 'x'.repeat(601) }] }] } }]) {
    assert.equal(await transcribeFrenchTake(audio, { key: 'test', request: async () => Response.json(payload) }), null);
  }
  assert.equal(await transcribeFrenchTake(audio, { key: 'test', request: async () => new Response('x'.repeat(65 * 1024)) }), null);
  assert.equal(await transcribeFrenchTake(audio, { key: 'test', request: async () => new Response('{}', { status: 503 }) }), null);
  assert.equal(await transcribeFrenchTake(audio, { key: 'test', request: async () => { throw new Error('offline'); } }), null);
  for (const invalid of [Buffer.alloc(0), Buffer.from('unknown'), Buffer.alloc(2 * 1024 * 1024 + 1)]) {
    assert.equal(await transcribeFrenchTake(invalid, { key: 'test', request }), null);
  }
  assert.equal(await transcribeFrenchTake(audio, { key: '', request }), null);
  assert.equal(calls, 1);
});
