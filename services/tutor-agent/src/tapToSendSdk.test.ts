/**
 * Tap-to-send through the installed SDK's real AgentSession (tapToSend.ts).
 *
 * The ears are faked exactly as in pauseEndpointingSdk.test.ts: a scripted
 * VAD and a scripted recogniser. The turn handling is the lesson's own
 * (`turnHandlingFor('lesson')`, so preemptive generation is on) and turn
 * detection is left unset, so SDK 1.9 builds its default audio detector,
 * exactly as agent.ts leaves it. A counting FakeLLM measures what a held turn
 * costs in model calls.
 *
 * One session, real timers, about eleven seconds. Handing the saved detector
 * instance back on switch-off instead of null fails the last assertion here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadableStream, type ReadableStreamDefaultController } from 'node:stream/web';
import { initializeLogger, llm, stt, voice, VAD, VADStream, VADEventType, type VADEvent } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';

import { turnHandlingFor } from './turnHandling.ts';
import { TapToSend } from './tapToSend.ts';

initializeLogger({ pretty: false, level: 'silent' });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Silero's default: END_OF_SPEECH arrives this long after the last voiced frame. */
const VAD_SILENCE_MS = 550;
const PAUSE_MS = 1_000;

class ScriptedVADStream extends VADStream {
  constructor(vad: VAD) {
    super(vad);
    void this.drain();
  }
  private async drain(): Promise<void> {
    try {
      while (!this.closed) {
        const { done } = await this.inputReader.read();
        if (done) break;
      }
    } catch { /* closed */ }
  }
  emit(type: VADEventType, extra: Partial<VADEvent> = {}): void {
    this.sendVADEvent({
      type, samplesIndex: 0, timestamp: Date.now(), speechDuration: 0, silenceDuration: 0, frames: [],
      probability: type === VADEventType.END_OF_SPEECH ? 0 : 1, inferenceDuration: 0,
      speaking: type !== VADEventType.END_OF_SPEECH, rawAccumulatedSilence: 0, rawAccumulatedSpeech: 0, ...extra,
    });
  }
}

class ScriptedVAD extends VAD {
  label = 'scripted-vad';
  streams: ScriptedVADStream[] = [];
  constructor() { super({ updateInterval: 32 }); }
  stream(): ScriptedVADStream {
    const s = new ScriptedVADStream(this);
    this.streams.push(s);
    return s;
  }
}

class ScriptedSpeechStream extends stt.SpeechStream {
  label = 'scripted-stt.stream';
  protected async run(): Promise<void> {
    for await (const _ of this.input) { /* audio is ignored; transcripts are scripted */ }
  }
  final(text: string): void {
    this.queue.put({
      type: stt.SpeechEventType.FINAL_TRANSCRIPT,
      alternatives: [{ text, language: 'fr' as never, startTime: 0, endTime: 0, confidence: 1 }],
    });
  }
}

class ScriptedSTT extends stt.STT {
  label = 'scripted-stt';
  streams: ScriptedSpeechStream[] = [];
  constructor() { super({ streaming: true, interimResults: false }); }
  protected async _recognize(): Promise<stt.SpeechEvent> { throw new Error('streaming only'); }
  stream(): ScriptedSpeechStream {
    const s = new ScriptedSpeechStream(this);
    this.streams.push(s);
    return s;
  }
}

class SilentInput extends voice.AudioInput {
  private controller!: ReadableStreamDefaultController<AudioFrame>;
  constructor() {
    super();
    this.multiStream.addInputStream(new ReadableStream<AudioFrame>({ start: (c) => { this.controller = c; } }));
  }
  push(): void { this.controller.enqueue(new AudioFrame(new Int16Array(800), 16_000, 1, 800)); }
}

class RecordingAgent extends voice.Agent {
  turns: string[] = [];
  constructor() { super({ instructions: 'Offline endpointing proof.' }); }
  override async onUserTurnCompleted(_ctx: llm.ChatContext, message: llm.ChatMessage): Promise<void> {
    this.turns.push((message.textContent ?? '').trim());
    throw new voice.StopResponse();
  }
}

async function waitFor(check: () => boolean, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (!check() && Date.now() < until) await sleep(20);
}

/** One spoken phrase: speech, its final transcript, silence ticks, end of speech. */
async function phrase(vad: ScriptedVADStream, rec: ScriptedSpeechStream, text: string): Promise<void> {
  vad.emit(VADEventType.START_OF_SPEECH, { speechDuration: 100 });
  for (let i = 0; i < 4; i++) {
    await sleep(100);
    vad.emit(VADEventType.INFERENCE_DONE, { speaking: true, rawAccumulatedSpeech: 100 * (i + 1) });
  }
  rec.final(text);
  await sleep(250);
  // 250 ms of silence while still "speaking": the SDK asks its turn detector here.
  vad.emit(VADEventType.INFERENCE_DONE, { speaking: true, rawAccumulatedSilence: 250 });
  await sleep(VAD_SILENCE_MS - 250);
  vad.emit(VADEventType.END_OF_SPEECH, { silenceDuration: VAD_SILENCE_MS, speechDuration: 400 });
}

/** Counts every completion the session asks for, preemptive or not. */
class CountingLLM extends voice.testing.FakeLLM {
  calls = 0;
  override chat(options: Parameters<voice.testing.FakeLLM['chat']>[0]): ReturnType<voice.testing.FakeLLM['chat']> {
    this.calls += 1;
    return super.chat(options);
  }
}

test('a held turn survives a long pause, Send commits it, and switching off restores pause endpointing', { timeout: 30_000 }, async () => {
  const vad = new ScriptedVAD();
  const recogniser = new ScriptedSTT();
  const model = new CountingLLM();
  const session = new voice.AgentSession({ vad, stt: recogniser, llm: model, turnHandling: turnHandlingFor('lesson', { startRung: 4 }) });
  const agent = new RecordingAgent();
  const input = new SilentInput();
  session.input.audio = input;
  await session.start({ agent, record: false });
  const tap = new TapToSend(() => session, { setHeldTurn() {} }, () => {});
  // Wired the way agent.ts wires it.
  session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => { if (ev.newState === 'speaking') tap.learnerSpeaking(true); });
  tap.markLive(); // agent.ts calls this once session.start has resolved
  const pump = setInterval(() => input.push(), 50);
  try {
    await waitFor(() => vad.streams.length > 0 && recogniser.streams.length > 0, 5_000);
    const v = vad.streams.at(-1)!;
    const r = recogniser.streams.at(-1)!;

    tap.setOn(true);
    await phrase(v, r, 'Je voudrais');
    await sleep(3_000); // a long think, far past every pause floor
    await phrase(v, r, 'un café');
    await sleep(1_000);
    assert.deepEqual(agent.turns, [], 'a pause ended a held turn');
    assert.equal(model.calls, 0, 'preemptive generation billed a held turn');

    assert.equal(tap.open, true, 'the first speech did not open a held turn');
    tap.send();
    await waitFor(() => agent.turns.length > 0, 3_000);
    assert.deepEqual(agent.turns, ['Je voudrais un café'], 'Send did not commit the whole held turn');

    tap.setOn(false);
    await phrase(v, r, 'Merci');
    await waitFor(() => agent.turns.length > 1, 3_000);
    assert.deepEqual(agent.turns, ['Je voudrais un café', 'Merci'], 'after switching off, a pause no longer ends a turn');
  } finally {
    clearInterval(pump);
    await session.close().catch(() => {});
  }
});

/** The detector the speech recogniser actually runs with. Private in the SDK; read for this proof only. */
function liveDetector(session: voice.AgentSession): unknown {
  return (session as unknown as { activity?: { audioRecognition?: { turnDetector?: unknown } } }).activity?.audioRecognition?.turnDetector;
}

test('tap-to-send switched on before session.start leaves the default detector in place, and a pause commits after switch-off', { timeout: 30_000 }, async () => {
  const vad = new ScriptedVAD();
  const recogniser = new ScriptedSTT();
  const session = new voice.AgentSession({ vad, stt: recogniser, turnHandling: turnHandlingFor('convo', { startRung: 4 }) });
  const agent = new RecordingAgent();
  const input = new SilentInput();
  session.input.audio = input;
  const tap = new TapToSend(() => session, { setHeldTurn() {} }, () => {});
  // The app sends its switch right after `ready`, which can beat session.start.
  tap.setOn(true);
  await session.start({ agent, record: false });
  tap.markLive();
  assert.ok(liveDetector(session) !== undefined, 'the session was built without its audio turn detector');
  const pump = setInterval(() => input.push(), 50);
  try {
    await waitFor(() => vad.streams.length > 0 && recogniser.streams.length > 0, 5_000);
    const v = vad.streams.at(-1)!;
    const r = recogniser.streams.at(-1)!;
    assert.equal(tap.on, true, 'the early switch was lost');
    tap.setOn(false);
    assert.ok(liveDetector(session) !== undefined, 'switching off lost the detector');
    await phrase(v, r, 'Bonjour');
    await waitFor(() => agent.turns.length > 0, 3_000);
    assert.deepEqual(agent.turns, ['Bonjour'], 'a pause no longer ends a turn');
  } finally {
    clearInterval(pump);
    await session.close().catch(() => {});
  }
});
