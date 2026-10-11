import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import { ReadableStream, type ReadableStreamDefaultController } from 'node:stream/web';
import { initializeLogger, voice } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';
import * as deepgram from '@livekit/agents-plugin-deepgram';
// ws is already a runtime dependency; keep this fixture's small server surface
// explicit because the worker intentionally does not depend on @types/ws.
interface TestSocket extends EventEmitter { terminate(): void; ping(): void }
interface TestServer extends EventEmitter {
  clients: Set<TestSocket>;
  address(): AddressInfo | string | null;
  close(callback: () => void): void;
}
const { WebSocketServer } = createRequire(import.meta.url)('ws') as {
  WebSocketServer: new (options: { host: string; port: number }) => TestServer;
};

initializeLogger({ pretty: false, level: 'silent' });

class SilentInput extends voice.AudioInput {
  private controller!: ReadableStreamDefaultController<AudioFrame>;
  constructor() {
    super();
    this.multiStream.addInputStream(new ReadableStream<AudioFrame>({ start: controller => { this.controller = controller; } }));
  }
  push(): void { this.controller.enqueue(new AudioFrame(new Int16Array(1600), 16_000, 1, 1600)); }
}

test('installed SDK reopens the same recognizer in French and applies current session keyterms', { timeout: 10_000 }, async t => {
  // A local fake vendor sees the actual connection query. No real audio, key,
  // account, LiveKit room or provider request is involved.
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  t.after(async () => {
    for (const socket of server.clients) socket.terminate();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `ws://127.0.0.1:${address.port}`;
  const recognizer = new deepgram.STT({ apiKey: 'offline-test-key', baseUrl, model: 'nova-3', language: 'multi' });
  const agent = new voice.Agent({ instructions: 'Offline recognition wiring proof.' });
  const session = new voice.AgentSession({ stt: recognizer, turnDetection: 'manual' });
  t.after(() => session.close());
  const input = new SilentInput();
  session.input.audio = input;

  const firstConnection = once(server, 'connection');
  await session.start({ agent, record: false });
  input.push();
  const [, firstRequest] = await firstConnection as [TestSocket, IncomingMessage];
  assert.ok(firstRequest.url);
  assert.equal(new URL(firstRequest.url, baseUrl).searchParams.get('language'), 'multi');

  recognizer.updateOptions({ language: 'fr' });
  const frenchConnection = once(server, 'connection');
  await agent.updateOptions({ stt: recognizer });
  input.push();
  const [frenchSocket, frenchRequest] = await frenchConnection as [TestSocket, IncomingMessage];
  assert.ok(frenchRequest.url);
  assert.equal(new URL(frenchRequest.url, baseUrl).searchParams.get('language'), 'fr');
  // Wait until the client has processed its open event before asking its
  // stream to reconnect; the server's connection event precedes that moment.
  const ready = once(frenchSocket, 'pong');
  frenchSocket.ping();
  await ready;

  const biasedConnection = once(server, 'connection');
  session.updateOptions({ keyterms: ['Sur place.', 'À emporter.'] });
  const [, biasedRequest] = await biasedConnection as [TestSocket, IncomingMessage];
  assert.ok(biasedRequest.url);
  const params = new URL(biasedRequest.url, baseUrl).searchParams;
  assert.equal(params.get('language'), 'fr');
  assert.deepEqual(params.getAll('keyterm'), ['Sur place.', 'À emporter.']);
});
