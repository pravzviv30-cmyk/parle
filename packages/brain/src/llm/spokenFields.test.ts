import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sampleTurn } from '../contract/samples.ts';
import { TurnSchema } from '../contract/schemas.ts';
import type { TutorTurn } from '../contract/types.ts';
import { SpokenFieldsWatcher, earlySpokenFrom } from './spokenFields.ts';
import { OpenAiResponsesBrainClient, readResponseEvents } from './openaiResponses.ts';

/** The turn as strict structured output writes it: properties in schema order. */
function inSchemaOrder(turn: TutorTurn): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(TurnSchema.shape)) ordered[key] = (turn as Record<string, unknown>)[key];
  return JSON.stringify(ordered);
}

/** Chop text into uneven pieces, the way a network delivers it. */
function pieces(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

test('the schema puts every spoken field before anything that is only shown or remembered', () => {
  const keys = Object.keys(TurnSchema.shape);
  const reply = keys.indexOf('sceneReply');
  for (const spoken of ['assessment', 'coach', 'coachLine', 'narration']) {
    assert.ok(keys.indexOf(spoken) < reply, `${spoken} must stream before the reply it shapes`);
  }
  for (const later of ['support', 'newPhrases', 'profileSignals', 'topicShift', 'scene']) {
    assert.ok(keys.indexOf(later) > reply, `${later} must not delay the tutor's voice`);
  }
});

test('the spoken fields are handed over once, the moment sceneReply closes, at any chunking', () => {
  const turn = sampleTurn({ coachLine: 'Dites « un café », tout simplement.', sceneReply: { speaker: 'Karim', fr: 'Très bien, {un} "café" \\ tout de suite !', frWritten: null, en: 'Right away!' } });
  const text = inSchemaOrder(turn);
  const replyEnds = text.indexOf('"support"') - 1; // the comma after sceneReply
  for (const size of [1, 3, 17, 64, text.length]) {
    const watcher = new SpokenFieldsWatcher();
    let seen = 0, at = -1, early = null;
    for (const piece of pieces(text, size)) {
      const got = watcher.feed(piece);
      seen += piece.length;
      if (got) { early = got; at = seen; }
    }
    assert.ok(early, `chunk size ${size}: nothing handed over`);
    assert.deepEqual(early, {
      assessment: turn.assessment, coach: turn.coach, coachLine: turn.coachLine, narration: turn.narration, sceneReply: turn.sceneReply,
    });
    assert.ok(at <= replyEnds + size, `chunk size ${size}: handed over late, after the reply had closed`);
    assert.ok(at < text.length || size === text.length, 'before the end of the turn whenever the chunking allows');
  }
});

test('anything unexpected means no early hand-over, never a wrong one', () => {
  const turn = sampleTurn();
  // Old order: the reply before the narration. The early fields are incomplete.
  const oldOrder = JSON.stringify({ assessment: turn.assessment, coach: turn.coach, coachLine: turn.coachLine, sceneReply: turn.sceneReply, narration: turn.narration });
  assert.equal(new SpokenFieldsWatcher().feed(oldOrder), null);
  // A reply that does not validate.
  const invalid = inSchemaOrder({ ...turn, sceneReply: { speaker: 'Karim' } as never });
  assert.equal(new SpokenFieldsWatcher().feed(invalid), null);
  assert.equal(earlySpokenFrom('{"assessment": {'), null);
  // A key named sceneReply inside a nested value is not the top-level reply.
  const nested = inSchemaOrder({ ...turn, coachLine: '"sceneReply": {}' });
  const watcher = new SpokenFieldsWatcher();
  assert.deepEqual(watcher.feed(nested)?.sceneReply, turn.sceneReply);
  assert.equal(watcher.feed('more'), null, 'and only once');
});

/** A Responses API event stream carrying the turn as text deltas. */
function eventStream(text: string, size: number, extra: { type: string; [key: string]: unknown }[] = []): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const events = [
    ...pieces(text, size).map((delta) => ({ type: 'response.output_text.delta', delta })),
    ...extra,
  ];
  const wire = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join('');
  return new ReadableStream({
    start(controller) {
      for (const chunk of pieces(wire, 23)) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function completedPayload(text: string) {
  return {
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    usage: { input_tokens: 100, output_tokens: 50, input_tokens_details: { cached_tokens: 20, cache_write_tokens: 5 } },
  };
}

test('a streamed live turn hands over its spoken fields early and still returns the whole validated turn', async () => {
  const turn = sampleTurn();
  const text = inSchemaOrder(turn);
  const bodies: Record<string, unknown>[] = [];
  const fetchFn = async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return { ok: true, status: 200, json: async () => { throw new Error('a stream has no JSON body'); },
      body: eventStream(text, 7, [{ type: 'response.completed', response: completedPayload(text) }]) };
  };
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, fetchFn as never, async () => {});
  const early: unknown[] = [];
  const result = await client.turn({
    kind: 'turn', system: { persona: 'p', pack: 'f', contract: 'c' }, messages: [{ role: 'user', text: 'Bonjour' }],
    onSpokenFields: (fields) => { early.push(fields); throw new Error('a caller bug must not cost the turn'); },
  });
  assert.equal(bodies[0]!.stream, true, 'the turn asked to stream');
  assert.equal(early.length, 1);
  assert.deepEqual((early[0] as TutorTurn).sceneReply, turn.sceneReply);
  assert.deepEqual(result.turn.sceneReply, turn.sceneReply);
  assert.deepEqual(result.turn.support, turn.support, 'the rest of the turn arrived intact');
  assert.equal(result.usage.inputTokens, 75);
});

test('a turn nobody will speak early, and every other activity, does not stream', async () => {
  const turn = sampleTurn();
  const bodies: Record<string, unknown>[] = [];
  const fetchFn = async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return { ok: true, status: 200, json: async () => completedPayload(inSchemaOrder(turn)) };
  };
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, fetchFn as never, async () => {});
  await client.turn({ kind: 'turn', system: { persona: 'p', pack: 'f', contract: 'c' }, messages: [] });
  assert.equal(bodies[0]!.stream, undefined);
});

test('a response with no readable body falls back to the JSON answer', async () => {
  const turn = sampleTurn();
  const fetchFn = async () => ({ ok: true, status: 200, json: async () => completedPayload(inSchemaOrder(turn)) });
  const client = new OpenAiResponsesBrainClient({ apiKey: 'test' }, fetchFn as never, async () => {});
  const result = await client.turn({ kind: 'turn', system: { persona: 'p', pack: 'f', contract: 'c' }, messages: [], onSpokenFields: () => {} });
  assert.deepEqual(result.turn.sceneReply, turn.sceneReply);
});

test('a failed or truncated stream is an error, never a half turn', async () => {
  const text = inSchemaOrder(sampleTurn());
  await assert.rejects(readResponseEvents(eventStream(text, 50, [{ type: 'response.failed', response: { error: { message: 'boom' } } }]), () => {}), /boom/);
  await assert.rejects(readResponseEvents(eventStream(text, 50), () => {}), /ended without a response/);
  await assert.rejects(readResponseEvents(eventStream(text, 50, [{ type: 'error', message: 'overloaded' }]), () => {}), /overloaded/);
});
