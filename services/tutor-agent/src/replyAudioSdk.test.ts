import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeLogger, tts, voice } from '@livekit/agents';
import { AudioFrame } from '@livekit/rtc-node';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CachedTTS } from './ttsCache.ts';
import { ReplyAudioScope } from './replyAudioScope.ts';
initializeLogger({ pretty: false, level: 'silent' });

class SyntheticTTS extends tts.TTS {
  label = 'synthetic-no-vendor';
  constructor() { super(16000, 1, { streaming: false }); }
  synthesize(text: string, options?: Parameters<tts.TTS['synthesize']>[1], signal?: AbortSignal) { return new SyntheticSentence(text, this, options, signal); }
  stream(): tts.SynthesizeStream { throw new Error('SDK must retain its sentence adapter'); }
}
class SyntheticSentence extends tts.ChunkedStream {
  label = 'synthetic-sentence';
  protected async run() {
    this.queue.put({ requestId: 'synthetic', segmentId: 'synthetic', final: true, frame: new AudioFrame(new Int16Array(1600), 16000, 1, 1600) });
  }
}
class Sink extends voice.AudioOutput {
  frames = 0;
  override async captureFrame(frame: AudioFrame) { await super.captureFrame(frame); this.frames++; }
  override flush() { super.flush(); this.onPlaybackFinished({ playbackPosition: 0.1, interrupted: false }); }
  override clearBuffer() { super.flush(); this.onPlaybackFinished({ playbackPosition: 0, interrupted: true }); }
}
class ScopedAgent extends voice.Agent {
  scope = new ReplyAudioScope<AudioFrame>();
  constructor() { super({ instructions: 'No generated replies. Synthetic audio only.' }); }
  override async ttsNode(text: Parameters<voice.Agent['ttsNode']>[0], settings: Parameters<voice.Agent['ttsNode']>[1]): ReturnType<voice.Agent['ttsNode']> {
    const frames = await voice.Agent.default.ttsNode(this, text, settings);
    return frames ? this.scope.observe(frames) : frames;
  }
}

test('SDK queued say preserves the guarded frame scope beside an unmeasured opener', { timeout: 10000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'luvani-sdk-frame-'));
  const cache = new CachedTTS(new SyntheticTTS(), { dir, voiceKey: 'synthetic-only' });
  const session = new voice.AgentSession({ tts: cache, turnDetection: 'manual' });
  const agent = new ScopedAgent(); const sink = new Sink(16000); session.output.audio = sink;
  const seen: string[] = [];
  try {
    await session.start({ agent, record: false });
    const opener = session.say('An invented opener.', { allowInterruptions: true });
    const scene = agent.scope.dispatch({ firstFrame: () => seen.push('scene') }, () => session.say('A complete guarded reply.', { allowInterruptions: true }));
    const second = agent.scope.dispatch({ firstFrame: () => seen.push('second') }, () => session.say('A second guarded reply.', { allowInterruptions: true }));
    const replay = session.say('An unmeasured replay.', { allowInterruptions: true });
    await Promise.all([opener.waitForPlayout(), scene.waitForPlayout(), second.waitForPlayout(), replay.waitForPlayout()]);
    assert.equal(typeof scene.id, 'string'); assert.deepEqual(seen, ['scene', 'second']); assert.ok(sink.frames >= 4);
    const cancelled = agent.scope.dispatch({ firstFrame: () => seen.push('cancelled') }, () => session.say('A cancelled queued reply.', { allowInterruptions: true }));
    cancelled.interrupt(true); await cancelled.waitForPlayout();
    assert.deepEqual(seen, ['scene', 'second']);
  } finally { await session.close(); await rm(dir, { recursive: true, force: true }); }
});
