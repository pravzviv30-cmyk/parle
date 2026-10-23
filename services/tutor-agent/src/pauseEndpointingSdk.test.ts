/**
 * A mid-sentence pause through the installed SDK's real AgentSession
 * (VOICE-010).
 *
 * Only the ears are faked: a scripted VAD and a scripted recogniser. The turn
 * handling is the worker's own (`turnHandlingFor`), and turn detection is left
 * unset exactly as agent.ts leaves it, so SDK 1.9 builds its default audio
 * turn detector. With no job inference executor that detector scores every
 * pause 1.0, "done", which is the worst case: if a beginner's sentence
 * survives here, the floor holds even when the audio model is no help.
 *
 * The script is a learner saying "Je voudrais", pausing for a second, and
 * finishing "un café". Real timers, about four seconds a case.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReadableStream, type ReadableStreamDefaultController } from 'node:stream/web';
import { initializeLogger, llm, stt, voice, VAD, VADStream, VADEventType, type VADEvent } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';

import { turnHandlingFor } from './turnHandling.ts';
import type { Rung } from '@luvani/core';

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

async function speakWithAPause(startRung: Rung): Promise<string[]> {
  const vad = new ScriptedVAD();
  const recogniser = new ScriptedSTT();
  const session = new voice.AgentSession({
    vad,
    stt: recogniser,
    turnHandling: turnHandlingFor('convo', { startRung }),
  });
  const agent = new RecordingAgent();
  const input = new SilentInput();
  session.input.audio = input;
  await session.start({ agent, record: false });
  const pump = setInterval(() => input.push(), 50);
  try {
    await waitFor(() => vad.streams.length > 0 && recogniser.streams.length > 0, 5_000);
    const v = vad.streams.at(-1)!;
    const r = recogniser.streams.at(-1)!;
    await phrase(v, r, 'Je voudrais');
    await sleep(PAUSE_MS - VAD_SILENCE_MS); // the rest of the pause after END_OF_SPEECH
    await phrase(v, r, 'un café');
    await waitFor(() => agent.turns.length > 0 && agent.turns.join(' ').includes('café'), 4_000);
    await sleep(300);
    return agent.turns;
  } finally {
    clearInterval(pump);
    await session.close().catch(() => {});
  }
}

test('a beginner who pauses for a second mid-sentence gets one turn, not two', { timeout: 20_000 }, async () => {
  const turns = await speakWithAPause(1);
  assert.deepEqual(turns, ['Je voudrais un café'], 'the tutor answered half a sentence');
});

test('the same pause at the 400 ms floor ends the turn early, so this test can see a cut-off', { timeout: 20_000 }, async () => {
  const turns = await speakWithAPause(4);
  assert.deepEqual(turns, ['Je voudrais', 'un café']);
});
