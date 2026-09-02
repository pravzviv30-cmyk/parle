/**
 * One sample clip per voice, so a learner can hear a voice before choosing it.
 *
 *   npm run voice-samples -w @luvani/tutor-agent
 *
 * Writes apps/mobile/assets/voices/<key>.m4a, one file per catalogue voice,
 * bundled with the app and played by the chooser.
 *
 * THROUGH THE SEAM, NOT AROUND IT. Every clip is synthesized by
 * `buildTTS({ voice, missTransport: 'http' })` — the same function the agent
 * calls to speak in a live session. That is the whole design decision here. A
 * clip made by a hand-rolled vendor request would be an approximation: it would
 * miss the pinned model, the pinned language code and the voice settings, all
 * of which change what a voice sounds like, and a learner would choose a voice
 * from a sample and then meet a different one. Going through `buildTTS` also
 * means the clips land in the ordinary TTS cache, so a rerun is free, and the
 * French sentence is a real tutor opening that a live session may later hit.
 *
 * SENTENCE BY SENTENCE, for the same reason warmCache.ts is: our TTS declares
 * `streaming: false`, so at runtime the framework hands it one sentence at a
 * time. Synthesizing the two sentences separately and joining the audio is both
 * what the learner will actually hear and what keeps the cache keys real.
 *
 * WHAT IT COSTS. Eight voices at about sixty characters each is under five
 * hundred characters, once. This is the cheap script; warmCache.ts is the
 * expensive one.
 *
 * BUNDLE SIZE IS THE CONSTRAINT. These ship inside the app download, so eight
 * clips is eight times whatever one weighs. AAC at 48 kbit/s mono puts a
 * four-second clip near 20KB; the ceiling below is 150KB and a clip that
 * exceeds it never reaches the assets folder at all, because a file that big
 * would be found by a reviewer's download-size complaint rather than by us.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioFrame } from '@livekit/rtc-node';
import { initializeLogger, tokenize } from '@livekit/agents';
import { TUTOR_VOICES, tutorVoice, type TutorVoiceKey } from '@luvani/core';
import { buildTTS, selectedVoiceVendor, VOICE_KEY } from './voice.ts';
import { encodeWav, type WavData } from './wav.ts';

/**
 * Where the app looks. Resolved from this file rather than from the cwd,
 * because the script is run through npm from wherever the operator happens to
 * be standing and a relative path would quietly write clips into a temp folder.
 */
export const SAMPLES_DIR = fileURLToPath(new URL('../../../apps/mobile/assets/voices', import.meta.url));

/** The bundle budget for one clip. Eight of these ship in every download. */
export const MAX_SAMPLE_BYTES = 150 * 1024;

/** Mono AAC at this rate is transparent enough for a voice sample and small. */
const BITRATE_BPS = 48000;

/** A beat between the two sentences, so they read as one clip and not a splice. */
const GAP_MS = 350;

/** The file the app bundles for one voice. */
export function samplePath(key: TutorVoiceKey): string {
  return join(SAMPLES_DIR, `${key}.m4a`);
}

/**
 * What each voice says.
 *
 * Bilingual on purpose: the tutor speaks French in the scene and English when
 * it explains, and a learner choosing a voice is choosing both. One French
 * sentence and one English one is the shortest thing that shows the pair.
 *
 * The persona's name is in it because the name is what the learner is really
 * picking. Two of the eight are women, so a clip that said "Luc" in Céline's
 * voice would be the exact mismatch the catalogue exists to prevent.
 *
 * The copy obeys the catalogue's rule about `sound`: it states nothing that has
 * not been verified and makes no comparison. It also asks for nothing. A sample
 * that ended "now repeat after me" would be a learner pressed to speak by a
 * button they tapped to listen, and the product's promise is that speaking
 * aloud is never forced.
 */
export function sampleText(key: TutorVoiceKey): string {
  const { name } = tutorVoice(key).persona;
  // The English line is the translation, not commentary about the voice. The
  // synthesis request stays French-language (see voice.ts), so the same French
  // voice carries both sides of the sample rather than switching persona or
  // accent halfway through.
  return `Bonjour, je m’appelle ${name}. Hello, my name is ${name}.`;
}

/**
 * The same sentence splitter the runtime and the warm cache use. Kept identical
 * for the reason spelled out in warmCache.ts: a different split here would make
 * cache entries nothing else ever asks for, and the clip would stop being what
 * the tutor sounds like.
 */
const splitter = new tokenize.basic.SentenceTokenizer();

/** The clip's sentences, exactly as the vendor will be asked for them. */
export function sampleSentences(key: TutorVoiceKey): string[] {
  return splitter.tokenize(sampleText(key));
}

/**
 * The encoders this script knows how to drive, in preference order.
 *
 * ffmpeg first because it exists on every platform; afconvert second because it
 * is already on every Mac and this script is usually run on the founder's
 * laptop. Neither is a dependency worth adding to package.json for a script
 * that runs a handful of times in the life of the product.
 */
const ENCODERS = ['ffmpeg', 'afconvert'] as const;
type Encoder = (typeof ENCODERS)[number];

/**
 * Is the command on this machine?
 *
 * Checks `error` rather than the exit status: a missing binary sets ENOENT,
 * while a present one may well exit non-zero on a bare help flag, and treating
 * that as absent would send the operator hunting for an encoder they have.
 */
function present(command: string): boolean {
  return spawnSync(command, ['-h'], { stdio: 'ignore' }).error === undefined;
}

function encodeArgs(encoder: Encoder, wav: string, out: string): string[] {
  if (encoder === 'ffmpeg') {
    // -nostdin so a failure cannot leave the terminal waiting on a prompt.
    return ['-nostdin', '-y', '-i', wav, '-ac', '1', '-c:a', 'aac', '-b:a', String(BITRATE_BPS), out];
  }
  return ['-f', 'm4af', '-d', 'aac', '-b', String(BITRATE_BPS), wav, out];
}

/**
 * The two sentences as one clip, with a beat between them.
 *
 * Pulled out of the synthesis loop and exported so the assembly can be tested
 * against fabricated frames, which is the only part of this script a test can
 * exercise without paying a vendor. Everything above it in the call chain is a
 * billed network request.
 *
 * The header takes the first frame's rate and channel count: every frame in a
 * run comes from one configured vendor, so they agree, and taking them from the
 * frames rather than from a constant means a vendor change cannot silently
 * write a WAV that claims the wrong rate and plays at the wrong pitch.
 */
export function joinClip(frames: readonly AudioFrame[], gapMs: number = GAP_MS): WavData {
  const first = frames[0];
  if (!first) throw new Error('no audio to join');

  // Interleaved samples, so the gap is scaled by the channel count too.
  const gap = Math.round((first.sampleRate * first.channels * gapMs) / 1000);
  const parts: Int16Array[] = [];
  for (const frame of frames) {
    if (parts.length > 0) parts.push(new Int16Array(gap));
    parts.push(frame.data);
  }

  const total = parts.reduce((n, part) => n + part.length, 0);
  if (total === 0) throw new Error('no audio to join');
  const samples = new Int16Array(total);
  let offset = 0;
  for (const part of parts) {
    samples.set(part, offset);
    offset += part.length;
  }
  return { sampleRate: first.sampleRate, channels: first.channels, samples };
}

/**
 * Synthesize one voice's clip and return it as a 16-bit PCM WAV.
 *
 * A fresh CachedTTS per voice, because the voice is part of the cache key and
 * is fixed at construction. `chars` counts only the sentences that actually
 * reached the vendor, so a rerun reports the nothing it cost.
 */
async function synthesizeClip(voice: TutorVoiceKey): Promise<{ wav: Buffer; chars: number }> {
  const cached = buildTTS({ voice, missTransport: 'http' });
  try {
    const frames: AudioFrame[] = [];
    let chars = 0;
    for (const sentence of sampleSentences(voice)) {
      const before = cached.hits;
      frames.push(await cached.synthesize(sentence).collect());
      if (cached.hits === before) chars += sentence.length;
    }
    return { wav: encodeWav(joinClip(frames)), chars };
  } finally {
    // The HTTP path holds no socket, but the fish vendor holds a client and
    // eight of those is eight reasons this script would not exit.
    await cached.close();
  }
}

async function main(): Promise<void> {
  // Same refusal the warm run makes, and for the same reason: name the key the
  // selected vendor actually needs, never the other one.
  const key = VOICE_KEY[selectedVoiceVendor()];
  if (!process.env[key]) {
    console.error(`[voice-samples] ${key} is empty in services/tutor-agent/.env. Add it, then rerun.`);
    process.exit(1);
  }

  const encoder = ENCODERS.find(present);
  if (!encoder) {
    // Checked before the first synthesis. Discovering there is no encoder after
    // eight paid requests would mean paying again on the next attempt, which is
    // the one avoidable cost in this script.
    console.error(
      `[voice-samples] no audio encoder found. Install one of: ${ENCODERS.join(', ')} ` +
        `(afconvert ships with macOS; ffmpeg is 'brew install ffmpeg'). Nothing was synthesized.`,
    );
    process.exit(1);
  }

  mkdirSync(SAMPLES_DIR, { recursive: true });
  const voices = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
  console.log(`[voice-samples] ${voices.length} voices via ${encoder}, into ${SAMPLES_DIR}`);

  const tooBig: string[] = [];
  let billed = 0;

  for (const voice of voices) {
    const { wav, chars } = await synthesizeClip(voice);
    billed += chars;

    const dest = samplePath(voice);
    const wavTmp = `${dest}.tmp-${process.pid}.wav`;
    const m4aTmp = `${dest}.tmp-${process.pid}.m4a`;
    writeFileSync(wavTmp, wav);
    try {
      const run = spawnSync(encoder, encodeArgs(encoder, wavTmp, m4aTmp), { encoding: 'utf8' });
      if (run.status !== 0 || !existsSync(m4aTmp)) {
        throw new Error(`${encoder} failed for ${voice}: ${(run.stderr || '').trim().split('\n').pop()}`);
      }

      // Checked before it lands, not after. Writing an oversized clip into the
      // assets folder and printing a warning is how a 3MB bundle gets committed
      // by someone who did not read the terminal.
      const bytes = statSync(m4aTmp).size;
      if (bytes > MAX_SAMPLE_BYTES) {
        tooBig.push(`${voice} (${bytes} bytes)`);
        console.error(`[voice-samples] ${voice}: ${bytes} bytes is over the ${MAX_SAMPLE_BYTES} byte ceiling, not written`);
        continue;
      }

      renameSync(m4aTmp, dest);
      console.log(`  ${voice.padEnd(10)} ${String(bytes).padStart(6)} bytes  ${sampleText(voice)}`);
    } finally {
      rmSync(wavTmp, { force: true });
      rmSync(m4aTmp, { force: true });
    }
  }

  console.log(`[voice-samples] done: ${voices.length - tooBig.length}/${voices.length} clips, ~${billed} chars billed`);
  if (tooBig.length > 0) {
    console.error(
      `[voice-samples] over the ${MAX_SAMPLE_BYTES} byte bundle ceiling: ${tooBig.join(', ')}. ` +
        `Shorten the sample line or lower BITRATE_BPS, then rerun (synthesis is cached, so the rerun is free).`,
    );
    process.exit(1);
  }
}

/**
 * Only when run as a script.
 *
 * warmCache.ts has no such guard and does not need one: nothing imports it, and
 * its test spawns it as a process. This module is different, because the sample
 * text, the destination paths and the size ceiling are facts the tests check
 * directly — and a module that starts paying a vendor the moment it is imported
 * cannot be checked at all. dotenv is loaded here too rather than at the top,
 * so importing the pure parts never quietly rewrites process.env for whatever
 * else is running in the same process.
 */
const executedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (executedDirectly) {
  await import('dotenv/config');
  // The worker CLI does this for the agent; a standalone script must do it itself.
  initializeLogger({ pretty: true, level: 'warn' });
  main().catch((err) => {
    console.error('[voice-samples] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
