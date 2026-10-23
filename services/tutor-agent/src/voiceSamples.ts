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
 * SENTENCE BY SENTENCE, which is how the runtime does it. Our TTS declares
 * `streaming: false`, so the framework hands it one sentence at a time, and the
 * loop below does the same. It must not be "improved" into one batched request:
 * the cache key would stop being the one a live session asks for.
 *
 * There was a day when this line was a single sentence, on the theory that one
 * request carrying both languages would let the French half prime the accent of
 * the English half. The clips were made and played and it did nothing, because
 * the accent follows the recording and not the request. The line is two
 * sentences again (F505) and the accent is a question of which voices are in the
 * catalogue at all (F502).
 *
 * AND ONE RECORD. The clips are binaries, and a binary says nothing about the
 * words or the settings that made it. For a week these eight said a sentence
 * `sampleText` no longer returned, and no test could tell. So the run also
 * writes MANIFEST_PATH, and the suite compares it against the committed bytes
 * on every gate. What the clips SOUND like is still a question only an ear can
 * answer, which is what the `heard` field is for.
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

import { assertDevelopmentPaidTool } from './standalonePaidTool.ts';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AudioFrame } from '@livekit/rtc-node';
import { initializeLogger, tokenize } from '@livekit/agents';
import { TUTOR_VOICES, tutorSampleLine, type TutorVoiceKey } from '@luvani/core';
import { buildTTS, ELEVEN_VOICES, MODEL, selectedVoiceVendor, VOICE_KEY } from './voice.ts';
import { encodeWav, type WavData } from './wav.ts';

/**
 * Where the app looks. Resolved from this file rather than from the cwd,
 * because the script is run through npm from wherever the operator happens to
 * be standing and a relative path would quietly write clips into a temp folder.
 */
export const SAMPLES_DIR = fileURLToPath(new URL('../../../apps/mobile/assets/voices', import.meta.url));

/** The bundle budget for one clip. Eight of these ship in every download. */
export const MAX_SAMPLE_BYTES = 150 * 1024;

/**
 * Mono AAC at this rate, which is the most the source allows.
 *
 * The vendor returns 22050 Hz (see OUTPUT_ENCODING; 44.1 kHz is refused on this
 * plan), and at that rate the encoder rejects anything above 64 kbit/s outright.
 * It was 48 for months, chosen before anyone compared it with the ceiling. A
 * founder called the clips muffled and this was one of three causes; the other
 * two were the sample rate, which is a subscription, and the recordings, which
 * F502 replaced. Costs about 7KB a clip against a 150KB budget.
 */
const BITRATE_BPS = 64000;

/**
 * Peak level the clips are lifted to before encoding.
 *
 * The vendor hands back audio peaking near -4.8 dBFS, which is quiet enough that
 * a clip played next to anything else on a phone sounds thin, and thin is what a
 * listener calls low quality. This changes loudness and nothing else: same
 * samples, one multiplier, no filtering and no compression, so the voice a
 * learner picks is still the voice they meet. A little under 0 dBFS on purpose,
 * so the encoder has somewhere to put its overshoot.
 */
const PEAK_DBFS = -1;

/**
 * A beat between sentences, so the clip reads as one clip and not a splice.
 * The line is two sentences, so exactly one of these is inserted, between the
 * French and the English. `joinClip` pads only BETWEEN frames, so a one-sentence
 * line would get none, which is the single-frame path its test still covers.
 */
const GAP_MS = 350;

/** The file the app bundles for one voice. */
export function samplePath(key: TutorVoiceKey): string {
  return join(SAMPLES_DIR, `${key}.m4a`);
}

/**
 * Where the run records what it made, so a later gate can tell whether the
 * committed clips still match the words and the settings that produced them.
 *
 * Service-side, beside package.json, and deliberately NOT inside
 * apps/mobile/assets/voices/: everything under assets/ is a bundled asset, and
 * this is knowledge about how the clips were made rather than something the app
 * reads. Nothing enumerates that directory, so the app is untouched either way.
 */
export const MANIFEST_PATH = fileURLToPath(new URL('../voice-samples.manifest.json', import.meta.url));

/** What the run records about one clip. */
export type SampleRecord = {
  /** The exact string synthesized. */
  text: string;
  /** What the splitter actually handed the vendor. One element is the point. */
  requests: string[];
  /** The full cache key: voice id, model and every delivery setting, folded. */
  voiceKey: string;
  /** Part of the cache key, and part of the sound. */
  sampleRate: number;
  bytes: number;
  sha256: string;
  /** What the vendor had verified about this recording when the clip was made. */
  vendor: VendorRecord;
  /**
   * One plain line from whoever played it. The only field a human writes, and
   * the only evidence this repo can have about an accent, because no test here
   * can hear. Blank means nobody has listened to THIS audio yet.
   */
  heard: string;
};

export type SampleManifest = {
  $comment: string;
  version: 2;
  clips: Partial<Record<TutorVoiceKey, SampleRecord>>;
};

const MANIFEST_COMMENT =
  'Written by `npm run voice-samples -w @luvani/tutor-agent`. Only `heard` is written by hand. ' +
  'voiceSamples.test.ts compares every other field against the committed clips and the pinned ' +
  'voice configuration, so hand-editing this file makes the gate vouch for audio nobody made.';

/**
 * What the vendor says about a recording, read at the moment the clip was made.
 *
 * `voice.ts` used to claim in a comment that every voice was verified for French
 * and English. Nobody had asked, and it was false for all eight of them (F508).
 * A comment cannot be checked, so the claim moved here: the run reads the vendor's
 * own metadata and the suite compares it against the id table and the catalogue's
 * copy on every gate, offline, from the committed file.
 */
export type VendorRecord = {
  name: string;
  category: string;
  gender: string;
  age: string;
  /** The accent label per language, for the model the tutor pins. */
  accent: { fr: string; en: string };
  model: string;
  readAt: string;
};

/**
 * Ask the vendor what it has verified about one voice. Free: this is metadata,
 * not synthesis, so it costs no quota. Only the script calls it, never a test.
 */
export async function readVendorRecord(voiceId: string, model: string, readAt: string): Promise<VendorRecord> {
  const res = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    headers: { 'xi-api-key': process.env.ELEVEN_API_KEY ?? '' },
  });
  if (!res.ok) throw new Error(`vendor metadata for ${voiceId}: HTTP ${res.status}`);
  const body = (await res.json()) as {
    name?: string;
    category?: string;
    labels?: Record<string, string>;
    verified_languages?: { language?: string; model_id?: string; accent?: string }[];
  };
  const rows = body.verified_languages ?? [];
  const on = (language: string): string =>
    rows.find((r) => r.language === language && r.model_id === model)?.accent ?? 'not verified on this model';
  return {
    name: body.name ?? '',
    category: body.category ?? '',
    gender: body.labels?.gender ?? '',
    age: body.labels?.age ?? '',
    accent: { fr: on('fr'), en: on('en') },
    model,
    readAt,
  };
}

/** sha256 of a file, hex. The one field that editing a string cannot satisfy. */
export function sampleDigest(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** The manifest as committed, or an empty one when there is none yet. */
export function readManifest(path: string = MANIFEST_PATH): SampleManifest {
  if (!existsSync(path)) return { $comment: MANIFEST_COMMENT, version: 2, clips: {} };
  return JSON.parse(readFileSync(path, 'utf8')) as SampleManifest;
}

/**
 * Whether the previous listen still describes this audio.
 *
 * Synthesis is cached, so a rerun that changes nothing rewrites identical bytes,
 * and forcing a fresh listen for that would train whoever runs this to type
 * something in to get the gate green. So the attestation carries forward only
 * when the words, the configuration and the bytes are all unchanged. New words,
 * a retuned setting or different audio blank it, and the suite then demands an
 * ear before the clips can be pushed.
 */
export function carryAttestation(previous: SampleRecord | undefined, next: Omit<SampleRecord, 'heard'>): string {
  if (previous === undefined) return '';
  const same =
    previous.text === next.text &&
    previous.voiceKey === next.voiceKey &&
    previous.sha256 === next.sha256;
  return same ? previous.heard : '';
}

/**
 * What each voice says, which core owns.
 *
 * The words used to live here and were typed out a second time in the first-run
 * voice page, which is how the screen came to show a sentence the audio had
 * stopped saying. `tutorSampleLine` is now the only place either of them reads,
 * and its docstring carries why the line is one sentence and why the comma in
 * it is load-bearing.
 *
 * The export stays, rather than the script calling core directly, because the
 * copy rules for this line are asserted against `sampleText` in this package's
 * own suite, beside the script that pays to synthesize it.
 */
export function sampleText(key: TutorVoiceKey): string {
  return tutorSampleLine(key);
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
  // -q 127 is the encoder's own quality knob, separate from the bitrate, and it
  // is free: at this rate it produces a slightly SMALLER file than the default.
  return ['-f', 'm4af', '-d', 'aac', '-b', String(BITRATE_BPS), '-q', '127', wav, out];
}

/**
 * The same audio, lifted so its loudest sample sits at PEAK_DBFS.
 *
 * Pulled out and exported because it is pure arithmetic over the samples and is
 * therefore the only part of the loudness decision a test can exercise without
 * paying a vendor. Silence is returned untouched rather than divided by zero.
 */
export function levelClip(wav: WavData, peakDbfs: number = PEAK_DBFS): WavData {
  let peak = 0;
  for (const v of wav.samples) {
    const a = v < 0 ? -v : v;
    if (a > peak) peak = a;
  }
  if (peak === 0) return wav;

  const target = 32767 * 10 ** (peakDbfs / 20);
  const gain = target / peak;
  const samples = new Int16Array(wav.samples.length);
  for (let i = 0; i < wav.samples.length; i += 1) {
    const scaled = Math.round(wav.samples[i]! * gain);
    samples[i] = scaled > 32767 ? 32767 : scaled < -32768 ? -32768 : scaled;
  }
  return { ...wav, samples };
}

/**
 * The synthesized frames as one clip, with a beat between any two of them.
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
async function synthesizeClip(
  voice: TutorVoiceKey,
): Promise<{ wav: Buffer; chars: number; voiceKey: string; sampleRate: number }> {
  const cached = buildTTS({ voice, missTransport: 'http' });
  try {
    const frames: AudioFrame[] = [];
    let chars = 0;
    // Two iterations, one per sentence. Do NOT collapse this into a single
    // synthesize() of the whole text: the loop is what makes each request
    // identical to the one a live session would send, and therefore what makes
    // the cache key real. H4 pins per-sentence synthesis.
    for (const sentence of sampleSentences(voice)) {
      const before = cached.charsBilled;
      frames.push(await cached.synthesize(sentence).collect());
      chars += cached.charsBilled - before;
    }
    // Read off the instance rather than rebuilt from constants, so the record
    // carries what the plugin actually resolved and will have sent.
    return { wav: encodeWav(levelClip(joinClip(frames))), chars, voiceKey: cached.opts.voiceKey, sampleRate: cached.sampleRate };
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

  // Checked before the first paid request, for the same reason the encoder is.
  // Two sentences, French then English: it is what the manifest records, what the
  // beat is inserted between, and what a live session would send for this text.
  // One would mean the "and in English" bridge had crept back (F505); three would
  // mean a stray period is shipping inside every download.
  const wrong = (Object.keys(TUTOR_VOICES) as TutorVoiceKey[])
    .map((voice) => ({ voice, sentences: sampleSentences(voice) }))
    .filter(({ sentences }) => sentences.length !== 2 || !sentences[0]!.startsWith('Bonjour'));
  if (wrong.length > 0) {
    console.error(
      `[voice-samples] these lines are not one French sentence then one English one: ` +
        `${wrong.map((w) => `${w.voice} (${w.sentences.length})`).join(', ')}. ` +
        `Fix tutorSampleLine in core. Nothing was synthesized.`,
    );
    process.exit(1);
  }

  mkdirSync(SAMPLES_DIR, { recursive: true });
  const voices = Object.keys(TUTOR_VOICES) as TutorVoiceKey[];
  console.log(`[voice-samples] ${voices.length} voices via ${encoder}, into ${SAMPLES_DIR}`);

  const tooBig: string[] = [];
  let billed = 0;
  const previous = readManifest();
  // One timestamp for the run, so every row says when this set was read rather
  // than eight times that differ by milliseconds.
  const readAt = new Date().toISOString();
  const clips: Partial<Record<TutorVoiceKey, SampleRecord>> = {};

  for (const voice of voices) {
    const { wav, chars, voiceKey, sampleRate } = await synthesizeClip(voice);
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

      // Hashed AFTER the rename, so the digest is of the file that gets
      // committed rather than of a temp file that might differ.
      const made = {
        text: sampleText(voice),
        requests: sampleSentences(voice),
        voiceKey,
        sampleRate,
        bytes,
        sha256: sampleDigest(readFileSync(dest)),
        vendor: await readVendorRecord(ELEVEN_VOICES[voice], MODEL, readAt),
      };
      clips[voice] = { ...made, heard: carryAttestation(previous.clips[voice], made) };
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
    // The record is NOT written. A half-run must not leave a half-true manifest:
    // the suite would then vouch for seven clips and a stale eighth.
    process.exit(1);
  }

  const manifest: SampleManifest = { $comment: MANIFEST_COMMENT, version: 2, clips };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[voice-samples] recorded ${Object.keys(clips).length} clips in ${MANIFEST_PATH}`);

  const unheard = voices.filter((voice) => (clips[voice]?.heard ?? '') === '');
  if (unheard.length > 0) {
    // Not an error: the clips are correct and recorded. But the gate will refuse
    // until somebody has played them, because nothing in this repo can hear and
    // a sample's whole job is how it sounds.
    console.log(
      `[voice-samples] NOT YET HEARD: ${unheard.join(', ')}. Play each one, then write one plain line ` +
        `per voice into "heard" in the manifest. The suite fails while any is blank.`,
    );
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
  assertDevelopmentPaidTool();
  // The worker CLI does this for the agent; a standalone script must do it itself.
  initializeLogger({ pretty: true, level: 'warn' });
  main().catch((err) => {
    console.error('[voice-samples] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
