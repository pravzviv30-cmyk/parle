/**
 * F1160 (founder, 2026-11-24, DEV-006): a daily take under one second cannot
 * finish today's phrase, so the note says one more try is needed instead of
 * inviting the learner to compare a take that will not count.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SHORT = 'That one was very short. Try once more when you are ready.';

async function finishAfter(ms: number): Promise<{ note: string; completed: boolean }> {
  const source = readFileSync(new URL('./DailyPracticeScreen.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  const finish = (): Promise<void> => {');
  // The one type annotation is stripped so the body runs as plain JavaScript.
  const body = source.slice(start, source.indexOf('\n  useLayoutEffect(', start)).replace('(): Promise<void> =>', '() =>');
  const seen = { note: '', completed: false };
  const env = {
    finishing: { current: null }, generation: { current: 0 }, timer: { current: null }, live: { current: true },
    held: { current: null }, preparedUri: { current: 'file://take.m4a' }, startedRecording: { current: Date.now() - ms },
    recorder: {}, modelAsset: 1,
    finishLocalTake: async () => 'file://take.m4a',
    stopRecorder: async () => {}, recorderUri: () => 'file://take.m4a', resetRecordingAudio: async () => {}, discardRecording: () => {},
    setUri: () => {}, setRecording: () => {},
    setCompletedTake: (value: boolean) => { seen.completed = value; },
    setNote: (value: string) => { seen.note = value; },
  };
  const finish = new Function(...Object.keys(env), `${body}; return finish;`)(...Object.values(env)) as () => Promise<void>;
  await finish();
  return seen;
}

test('a take under a second says one more try is needed', async () => {
  const short = await finishAfter(400);
  assert.equal(short.completed, false);
  assert.equal(short.note, SHORT);

  const long = await finishAfter(1500);
  assert.equal(long.completed, true);
  assert.equal(long.note, 'Hear your take, then the model. Your take stays on this device until you leave.');
});
