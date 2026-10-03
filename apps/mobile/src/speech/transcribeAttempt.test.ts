import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { decideOwnWords, ownWordsFrom } from '@luvani/core';
import { FixLineSession } from '../drill/fixLineSession.ts';

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;
const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
async function shipped(name: string, symbol: string, dependencies: Record<string, unknown>) {
  const source = stripTypeScriptTypes(read(name).split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, ''));
  const names = Object.keys(dependencies);
  return new AsyncFunction(...names, `${source}\nreturn ${symbol};`)(...names.map(name => dependencies[name])) as Promise<(...args: unknown[]) => Promise<unknown>>;
}
async function client() {
  const state = { generation: 0, user: 'learner', uploaded: 0, beforeHeaders: () => {}, beforeReply: () => {} };
  const transcribe = await shipped('./transcribeAttempt.ts', 'transcribeRecordedAttempt', {
    File: class { bytes() { return Promise.resolve(new Uint8Array([1, 2, 3])); } },
    Platform: { OS: 'ios' },
    scopeGeneration: () => state.generation,
    auth: { getSession: async () => ({ id: state.user }) },
    authHeaders: async () => { state.beforeHeaders(); return { authorization: 'Bearer fake' }; },
    TOKEN_SERVER: 'https://tokens.invalid',
    fetch: async (url: string, init: RequestInit) => {
      state.uploaded++;
      assert.equal(url, 'https://tokens.invalid/drill/transcribe');
      assert.equal((init.headers as Record<string, string>)['x-luvani-user'], 'learner');
      state.beforeReply();
      return Response.json({ transcript: 'Je voudrais une table.' });
    },
  });
  return { state, transcribe };
}

test('closing a correction sheet during authentication starts no late audio upload and discards the take', async () => {
  let release!: () => void; let entered!: () => void; let uploads = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const transcribe = await shipped('./transcribeAttempt.ts', 'transcribeRecordedAttempt', {
    File: class { bytes() { return Promise.resolve(new Uint8Array([1, 2, 3])); } }, Platform: { OS: 'ios' },
    scopeGeneration: () => 1, auth: { getSession: async () => ({ id: 'learner' }) },
    authHeaders: async () => { entered(); await held; return { authorization: 'Bearer example' }; }, TOKEN_SERVER: 'https://tokens.invalid',
    fetch: async () => { uploads++; return Response.json({ transcript: 'J’ai vingt ans.' }); },
  });
  const removed: string[] = []; const changes: unknown[] = [];
  const session = new FixLineSession({ now: Date.now, current: () => true, changed: value => changes.push(value),
    transcribe: (uri, signal, current) => transcribe('learner', uri, 1, { signal, current }) as Promise<string | null>,
    discard: uri => removed.push(uri), judge: async () => null, success: () => assert.fail('no haptic after exit') });
  const take = session.take('file://temporary.m4a'); await ready;
  session.dispose(); await take;
  assert.deepEqual(removed, ['file://temporary.m4a'], 'cleanup need not wait for stalled auth');
  release(); for (let i = 0; i < 6; i++) await Promise.resolve();
  assert.equal(uploads, 0, 'closing before upload prevents the original privacy leak');
  assert.equal(changes.length, 1, 'only preparing words was shown');
});

test('closing during a correction upload aborts the actual fetch and leaves no late transcript', async () => {
  let entered!: () => void; let signal: AbortSignal | undefined;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const transcribe = await shipped('./transcribeAttempt.ts', 'transcribeRecordedAttempt', {
    File: class { bytes() { return Promise.resolve(new Uint8Array([1, 2, 3])); } }, Platform: { OS: 'ios' },
    scopeGeneration: () => 1, auth: { getSession: async () => ({ id: 'learner' }) }, authHeaders: async () => ({}), TOKEN_SERVER: 'https://tokens.invalid',
    fetch: async (_url: unknown, init: RequestInit) => {
      signal = init.signal as AbortSignal; entered();
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new DOMException('stopped', 'AbortError')), { once: true }));
    },
  });
  const removed: string[] = [];
  const session = new FixLineSession({ now: Date.now, current: () => true, changed: () => {},
    transcribe: (uri, abort, current) => transcribe('learner', uri, 1, { signal: abort, current }) as Promise<string | null>,
    discard: uri => removed.push(uri), judge: async () => null, success: () => assert.fail('no haptic') });
  const take = session.take('file://temporary.m4a'); await ready; session.dispose(); await take;
  assert.equal(signal?.aborted, true); assert.deepEqual(removed, ['file://temporary.m4a']); assert.equal(session.snapshot().phase, 'finished');
});

test('the transcription deadline also bounds stalled authentication and prevents a later upload', async () => {
  let expire!: () => void; let release!: () => void; let entered!: () => void; let uploads = 0; let cleared = false;
  const held = new Promise<void>(resolve => { release = resolve; }); const ready = new Promise<void>(resolve => { entered = resolve; });
  const transcribe = await shipped('./transcribeAttempt.ts', 'transcribeRecordedAttempt', {
    File: class { bytes() { return Promise.resolve(new Uint8Array([1])); } }, Platform: { OS: 'ios' }, scopeGeneration: () => 1,
    auth: { getSession: async () => ({ id: 'learner' }) }, authHeaders: async () => { entered(); await held; return {}; }, TOKEN_SERVER: 'https://tokens.invalid',
    fetch: async () => { uploads++; return Response.json({ transcript: 'late words' }); },
    setTimeout: (callback: () => void, ms: number) => { assert.equal(ms, 12_000); expire = callback; return 1; }, clearTimeout: () => { cleared = true; },
  });
  const pending = transcribe('learner', 'temporary.m4a', 1); await ready; expire(); assert.equal(await pending, null); assert.equal(cleared, true);
  release(); for (let i = 0; i < 6; i++) await Promise.resolve(); assert.equal(uploads, 0);
});

test('a spoken attempt is transcribed once, judged, and never stored', async () => {
  const c = await client();
  const removed: string[] = [];
  const consume = await shipped('./discardRecording.ts', 'consumeRecording', { removeRecording: (uri: string) => removed.push(uri) });
  const transcript = await consume('file://ephemeral.m4a', (uri: string) => c.transcribe('learner', uri, 0));
  assert.equal(transcript, 'Je voudrais une table.');
  assert.equal(c.state.uploaded, 1);
  assert.deepEqual(removed, ['file://ephemeral.m4a']);
  let judgments = 0;
  const judge = await shipped('./judgeAttempt.ts', 'judgeOwnWords', {
    auth: { getSession: async () => ({ id: 'learner' }) }, scopeGeneration: () => 0,
    loadProfile: async () => null, authHeaders: async () => ({}), TOKEN_SERVER: 'https://tokens.invalid',
    fetch: async (_url: string, init: RequestInit) => {
      judgments++;
      const body = JSON.parse(init.body as string);
      assert.equal(body.attempt, transcript);
      return Response.json({ verdict: { meaningKept: true, comprehensible: true, natural: 'yes', betterLine: null, note: '' } });
    },
  });
  assert.equal(judgments, 0, 'uploading alone cannot grade');
  const exercise = ownWordsFrom({ fr: 'Je voudrais une table.', en: 'I would like a table.', key: 'table' }, 'Ask for a table');
  const verdict = await judge('learner', exercise, transcript);
  assert.equal(decideOwnWords(verdict as Parameters<typeof decideOwnWords>[0], 0), 'good');
  assert.equal(judgments, 1);
  const screen = read('../DrillScreen.tsx');
  const recording = screen.slice(screen.indexOf('const recordOwnWords = useCallback('), screen.indexOf('const keepPhrase = useCallback('));
  assert.match(recording, /setTyped\(transcript\)/);
  assert.ok(!/judgeOwnWords\(|answerCurrent\(|savePractice\(|persistGrades\(/.test(recording), 'transcription cannot store an attempt or grade');
  assert.match(recording, /beat !== beatRef\.current/);
});

test('account changes before headers or during transcription discard the late words', async () => {
  for (const when of ['before', 'headers', 'response', 'scope']) {
    const c = await client();
    if (when === 'before') c.state.user = 'other';
    if (when === 'headers') c.state.beforeHeaders = () => { c.state.user = 'other'; };
    if (when === 'response') c.state.beforeReply = () => { c.state.user = 'other'; };
    if (when === 'scope') c.state.generation = 1;
    assert.equal(await c.transcribe('learner', 'file://old.m4a', 0), null, when);
    assert.equal(c.state.uploaded, when === 'response' ? 1 : 0, when);
  }
});

test('a refused or thrown transcription still removes its take and leaves no grade', async () => {
  for (const throws of [true, false]) {
    const removed: string[] = [];
    const consume = await shipped('./discardRecording.ts', 'consumeRecording', { removeRecording: (uri: string) => removed.push(uri) });
    const attempt = consume('file://refused.m4a', async () => { if (throws) throw new Error('refused'); return null; });
    if (throws) await assert.rejects(attempt, /refused/);
    else assert.equal(await attempt, null);
    assert.deepEqual(removed, ['file://refused.m4a']);
  }
});

test('an account switch while Check obtains its headers sends no earlier learner text', async () => {
  let user = 'learner';
  let requests = 0;
  let release!: () => void;
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const judge = await shipped('./judgeAttempt.ts', 'judgeOwnWords', {
    auth: { getSession: async () => ({ id: user }) }, scopeGeneration: () => 0,
    loadProfile: async () => null, TOKEN_SERVER: 'https://tokens.invalid',
    authHeaders: async () => { entered(); await held; return { authorization: 'Bearer other' }; },
    fetch: async () => { requests++; return Response.json({}); },
  });
  const exercise = ownWordsFrom({ fr: 'Une table.', en: 'A table.', key: 'table' }, 'Ask for a table');
  const pending = judge('learner', exercise, 'private previous words', 0);
  await ready;
  user = 'other'; release();
  assert.equal(await pending, null);
  assert.equal(requests, 0);
});
