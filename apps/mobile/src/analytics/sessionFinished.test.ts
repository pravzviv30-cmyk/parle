import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sessionFinishedEvent } from './sessionFinished.ts';

test('a finished session becomes counts and closed choices only', () => {
  const event = sessionFinishedEvent({ kind: 'convo', voice: true, turns: 9, rescues: 2, unassistedRate: 0.444, replyLatencyMs: 2310.6 });
  assert.deepEqual(event, {
    name: 'live_session_finished',
    properties: { kind: 'convo', voice: true, turns: 9, rescues: 2, unassistedPct: 44, replyLatencyMs: 2311 },
  });
});

test('out-of-range numbers are clamped or dropped, never sent raw', () => {
  const event = sessionFinishedEvent({ kind: 'lesson', voice: false, turns: -3, rescues: Number.NaN, unassistedRate: 1.7, replyLatencyMs: 45_000 });
  assert.deepEqual(event.properties, { kind: 'lesson', voice: false, turns: 0, rescues: 0, unassistedPct: 100, replyLatencyMs: null });
});

test('the event never carries why the learner is learning', () => {
  const union = readFileSync(new URL('./track.ts', import.meta.url), 'utf8');
  const line = union.split('\n').find((l) => l.includes("name: 'live_session_finished'"));
  assert.ok(line);
  assert.doesNotMatch(line, /goal|motivation|reason/i, 'the privacy document promises no event carries this');
});
