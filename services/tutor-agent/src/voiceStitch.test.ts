import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initializeLogger } from '@livekit/agents';

initializeLogger({ pretty: false, level: 'silent' });

import { ELEVEN_VOICES, MODEL, STREAMING_LATENCY, OUTPUT_ENCODING, VOICE_SETTINGS, buildTTS, elevenStitchedRequest } from './voice.ts';

const VOICE_ID = ELEVEN_VOICES.alexandre;
const PCM = Buffer.alloc(20_000, 3); // 10,000 samples at 22.05 kHz: several frames plus a remainder

describe('elevenStitchedRequest', () => {
  const sent: { url: string; init: RequestInit }[] = [];
  const answer = (status = 200, type = 'audio/pcm') => async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), init: init! });
    return new Response(status === 200 ? PCM : 'nope', { status, headers: { 'content-type': type } });
  };
  beforeEach(() => { sent.length = 0; });

  test('posts the plugin\'s URL and body plus previous_text, with the same key header, and returns frames', async () => {
    const stitch = elevenStitchedRequest({ voiceId: VOICE_ID, baseURL: 'http://127.0.0.1:9/elevenlabs/v1', apiKey: 'proxy-only', voiceSettings: VOICE_SETTINGS }, answer());
    const packets = [];
    for await (const packet of stitch('Moi aussi.', 'Alors, tu viens ?', 'eleven_flash_v2_5', new AbortController().signal)) packets.push(packet);

    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.url, `http://127.0.0.1:9/elevenlabs/v1/text-to-speech/${VOICE_ID}/stream?output_format=${OUTPUT_ENCODING}&enable_logging=false&optimize_streaming_latency=${STREAMING_LATENCY}`);
    assert.equal(sent[0]!.init.method, 'POST');
    assert.deepEqual(sent[0]!.init.headers, { 'xi-api-key': 'proxy-only', 'Content-Type': 'application/json' });
    const body = JSON.parse(String(sent[0]!.init.body));
    assert.deepEqual(Object.keys(body).sort(), ['apply_text_normalization', 'model_id', 'previous_text', 'text', 'voice_settings']);
    assert.equal(body.text, 'Moi aussi.');
    assert.equal(body.previous_text, 'Alors, tu viens ?');
    assert.equal(body.model_id, 'eleven_flash_v2_5', 'the model comes from the route of the line');
    assert.equal(body.apply_text_normalization, 'auto');
    assert.deepEqual(body.voice_settings, VOICE_SETTINGS);

    assert.ok(packets.length >= 2);
    assert.deepEqual(packets.map((p) => p.final), [...packets.slice(1).map(() => false), true], 'only the last frame is final');
    assert.equal(packets.reduce((n, p) => n + p.frame.data.byteLength, 0), PCM.length);
    assert.equal(packets[0]!.frame.sampleRate, 22050);
  });

  test('previous_text is cut from the front, at a space, to at most 600 bytes', async () => {
    const stitch = elevenStitchedRequest({ voiceId: VOICE_ID, baseURL: 'http://x/v1', apiKey: 'k', voiceSettings: VOICE_SETTINGS }, answer());
    const long = Array.from({ length: 200 }, (_, i) => `mot${i}é`).join(' ');
    for await (const packet of stitch('Oui.', long, MODEL, new AbortController().signal)) void packet;
    const previous = JSON.parse(String(sent[0]!.init.body)).previous_text as string;
    assert.ok(Buffer.byteLength(previous) <= 600);
    assert.ok(long.endsWith(previous), 'the end of the previous sentence is what the voice needs');
    assert.match(previous, /^mot\d+é/, 'cut at a word boundary, not mid-word');
  });

  test('a refused request throws before any audio, without echoing the vendor body', async () => {
    const stitch = elevenStitchedRequest({ voiceId: VOICE_ID, baseURL: 'http://x/v1', apiKey: 'k', voiceSettings: VOICE_SETTINGS }, answer(503, 'application/json'));
    await assert.rejects(async () => { for await (const packet of stitch('Oui.', 'Non.', MODEL, new AbortController().signal)) void packet; }, (error: Error & { status?: number }) => !error.message.includes('nope') && error.status === 503);
  });
});

describe('buildTTS and LUVANI_TTS_STITCH', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = { key: process.env.ELEVEN_API_KEY, stitch: process.env.LUVANI_TTS_STITCH, dir: process.env.TTS_CACHE_DIR, vendor: process.env.LUVANI_TTS_VENDOR };
    process.env.ELEVEN_API_KEY = 'test-key-never-sent';
    process.env.TTS_CACHE_DIR = mkdtempSync(join(tmpdir(), 'luvani-stitch-'));
    delete process.env.LUVANI_TTS_VENDOR;
    delete process.env.LUVANI_TTS_STITCH;
  });
  afterEach(() => {
    for (const [name, key] of [['key', 'ELEVEN_API_KEY'], ['stitch', 'LUVANI_TTS_STITCH'], ['dir', 'TTS_CACHE_DIR'], ['vendor', 'LUVANI_TTS_VENDOR']] as const) {
      if (saved[name] === undefined) delete process.env[key]; else process.env[key] = saved[name];
    }
  });

  test('off unless the value is exactly 1', () => {
    assert.equal(buildTTS().opts.stitch, undefined);
    for (const value of ['0', 'true', 'yes', '']) { process.env.LUVANI_TTS_STITCH = value; assert.equal(buildTTS().opts.stitch, undefined, value); }
    process.env.LUVANI_TTS_STITCH = '1';
    assert.equal(typeof buildTTS().opts.stitch, 'function');
  });

  describe('the request it makes', () => {
    const fetched: { url: string; init: RequestInit }[] = [];
    beforeEach(() => {
      fetched.length = 0;
      process.env.LUVANI_TTS_STITCH = '1';
      mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
        fetched.push({ url: String(url), init: init! });
        return new Response(Buffer.alloc(4000), { headers: { 'content-type': 'audio/pcm' } });
      });
    });
    afterEach(() => { mock.restoreAll(); });
    const run = async (stitch: ReturnType<typeof buildTTS>['opts']['stitch']) => {
      for await (const packet of stitch!('Oui.', 'Non.', 'eleven_multilingual_v2', new AbortController().signal)) void packet;
    };

    test('through the paid proxy: the proxy base URL, the placeholder key, and never the real key', async () => {
      const baseURL = 'http://127.0.0.1:9/elevenlabs/v1';
      await run(buildTTS({ baseURL }).opts.stitch);
      assert.equal(fetched.length, 1);
      assert.ok(fetched[0]!.url.startsWith(`${baseURL}/`), fetched[0]!.url);
      assert.equal((fetched[0]!.init.headers as Record<string, string>)['xi-api-key'], 'proxy-only');
      assert.ok(!JSON.stringify(fetched).includes('test-key-never-sent'), 'the real key appears nowhere in the request');
    });

    test('direct: the vendor URL and the env key', async () => {
      await run(buildTTS().opts.stitch);
      assert.ok(fetched[0]!.url.startsWith('https://api.elevenlabs.io/v1/'), fetched[0]!.url);
      assert.equal((fetched[0]!.init.headers as Record<string, string>)['xi-api-key'], 'test-key-never-sent');
    });

    test('matches the plugin\'s own request apart from previous_text', async () => {
      const cached = buildTTS();
      for await (const packet of cached.inner.synthesize('Oui.')) void packet;
      await run(cached.opts.stitch);
      assert.equal(fetched.length, 2);
      const [plugin, stitched] = fetched as [typeof fetched[number], typeof fetched[number]];
      assert.equal(stitched.url, plugin.url);
      assert.equal(stitched.init.method, plugin.init.method);
      assert.deepEqual(stitched.init.headers, plugin.init.headers);
      const { previous_text: previous, ...rest } = JSON.parse(String(stitched.init.body));
      assert.equal(previous, 'Non.');
      assert.deepEqual(JSON.parse(JSON.stringify(rest)), JSON.parse(String(plugin.init.body)));
    });
  });

  test('the cache key is the same with the switch on or off', () => {
    const off = buildTTS().opts.voiceKey;
    process.env.LUVANI_TTS_STITCH = '1';
    assert.equal(buildTTS().opts.voiceKey, off);
  });
});
