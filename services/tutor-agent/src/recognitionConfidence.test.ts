import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadableStream } from 'node:stream/web';
import { stt, voice } from '@livekit/agents';
import { CAFE_LESSON } from '@luvani/core';
import { createProfile, MockLlmClient } from '@luvani/brain';
import { LuvaniConversation } from './convo.ts';
import { LuvaniTutor } from './tutor.ts';
import { RecognitionConfidence, observeRecognitionConfidence } from './recognitionConfidence.ts';

function final(confidence: unknown): stt.SpeechEvent {
  return { type: stt.SpeechEventType.FINAL_TRANSCRIPT,
    alternatives: [{ language: 'fr', text: 'un café privé', startTime: 0, endTime: 1, confidence }],
  } as unknown as stt.SpeechEvent;
}

test('both live agent hooks observe final recognition confidence without changing events', async t => {
  const known = final(0.75);
  const unavailable = final(undefined);
  const lines: string[] = [];
  t.mock.method(console, 'info', (line: string) => lines.push(line));
  const mock = t.mock.method(voice.Agent.default, 'sttNode', async () =>
    ReadableStream.from((async function* () { yield known; yield unavailable; })()));
  const agents = [new LuvaniTutor(CAFE_LESSON), new LuvaniConversation(createProfile(), { client: new MockLlmClient() })];
  for (const agent of agents) {
    lines.length = 0;
    const output = await agent.sttNode(ReadableStream.from([]), {} as never);
    assert.ok(output);
    const seen = [];
    for await (const event of output) seen.push(event);
    assert.deepEqual(seen, [known, unavailable]);
    assert.equal(seen[0], known);
    assert.equal(seen[1], unavailable);
    assert.equal(lines.length, 2, `${agent.constructor.name} must observe both final segments`);
    assert.match(lines[0]!, /confidence=0\.750/);
    assert.match(lines[1]!, /confidence=unavailable/);
    assert.match(lines[1]!, /known=1 unavailable=1/);
    assert.ok(lines.every(line => !line.includes('café') && !line.includes('privé')));
  }
  assert.equal(mock.mock.callCount(), 2, 'use the public default once per stream');
});

test('recognition confidence separates unknown values and never substitutes another alternative', () => {
  const meter = new RecognitionConfidence();
  assert.equal(meter.observe('interim words'), null);
  assert.equal(meter.observe({ ...final(1), type: stt.SpeechEventType.INTERIM_TRANSCRIPT }), null);
  assert.match(meter.observe(final(0))!, /known=1 unavailable=0 confidence=0\.000$/);
  assert.match(meter.observe(final(1))!, /known=2 unavailable=0 confidence=1\.000$/);
  const invalid = [undefined, null, NaN, Infinity, -Infinity, -0.01, 1.01, '0.9'];
  for (const [index, value] of invalid.entries()) {
    assert.match(meter.observe(final(value))!, new RegExp(`known=2 unavailable=${index + 1} confidence=unavailable$`));
  }
  const two = final(undefined);
  two.alternatives!.push(final(0.99).alternatives![0]!);
  assert.match(meter.observe(two)!, /known=2 unavailable=9 confidence=unavailable$/);
  assert.match(meter.observe({ type: stt.SpeechEventType.FINAL_TRANSCRIPT })!, /known=2 unavailable=10/);
  const fresh = new RecognitionConfidence();
  assert.match(fresh.observe(final(0.5))!, /finalSegments=1 known=1 unavailable=0/);
});

test('recognition observation preserves every event even when telemetry throws', async () => {
  const events = ['interim', { ...final(0.3), type: stt.SpeechEventType.INTERIM_TRANSCRIPT }, final(0.7), final(null)];
  const lines: string[] = [];
  const stream = observeRecognitionConfidence((async function* () { yield* events; })(), line => {
    lines.push(line);
    throw new Error('operator sink unavailable');
  });
  const seen = [];
  for await (const event of stream) seen.push(event);
  assert.equal(lines.length, 2);
  assert.deepEqual(seen, events);
  assert.ok(seen.every((event, index) => event === events[index]));
  assert.ok(lines.every(line => !line.includes('café') && !line.includes('privé')));
});

test('recognition observation propagates stream errors and closes the source on cancellation', async () => {
  const failure = new Error('actual recognizer failure');
  const stream = observeRecognitionConfidence((async function* () { yield final(0.4); throw failure; })(), () => {});
  await stream.next();
  await assert.rejects(stream.next(), error => error === failure);
  let closed = false;
  const cancellable = observeRecognitionConfidence((async function* () {
    try { yield final(0.5); yield final(0.9); } finally { closed = true; }
  })(), () => {});
  await cancellable.next();
  await cancellable.return(undefined);
  assert.equal(closed, true);
});

test('both live confidence hooks preserve an absent default STT stream', async t => {
  t.mock.method(voice.Agent.default, 'sttNode', async () => null);
  for (const agent of [new LuvaniTutor(CAFE_LESSON), new LuvaniConversation(createProfile(), { client: new MockLlmClient() })]) {
    assert.equal(await agent.sttNode(ReadableStream.from([]), {} as never), null);
  }
});
