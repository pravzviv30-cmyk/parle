/**
 * Pronunciation assessment: the TonePerfect adapter.
 *
 * The founder's choice of scorer (2026-09-29), and the default whenever
 * `TONEPERFECT_API_KEY` is set; pronunciation.ts makes that choice and owns the
 * deadline. One paid call has been made, on the tutor's own recording of
 * "Bonjour, je vais prendre un café.", and its response is committed verbatim
 * as services/tutor-agent/src/fixtures/toneperfect-fr.json. Every symbol it
 * returned is plain IPA and maps through phoneMap.ts with no alias.
 *
 * Three things are known about this vendor that the code has to live with:
 *
 *   - **The model is marked experimental and uncalibrated.** The first success
 *     in a process logs the model id and that flag, so the log says which model
 *     graded a session.
 *   - **Only half the inventory has been seen.** 18 of the 36 sounds came back.
 *     The other 18 are in phoneMap as plain IPA, so they will map if they come
 *     back spelled that way; if not, the unknown-symbol line below names them.
 *   - **It is slow for a live turn.** 3.4 s for a 1.7 s clip. Every success
 *     logs its duration, so the first real sessions give a distribution rather
 *     than one number.
 *
 * What is sent is the audio, the reference line and the language, with the key
 * in a header and a random Idempotency-Key. Nothing that identifies the learner
 * leaves this function, so the assessment JSON the vendor says it keeps for up
 * to 24 hours holds a sentence and some phone scores and nobody's name.
 */

import { randomUUID } from 'node:crypto';
import type { PhonemeObservation } from '@luvani/core';
import { toInventoryIpa } from './phoneMap.ts';
import type { ScoreDeps, ScoreFetch, ScoreRequest } from './pronunciation.ts';

const ENDPOINT = 'https://api.toneperfect.app/v1/assess';

/** The first try and one retry. More would only spend a deadline the learner is waiting out. */
const MAX_ATTEMPTS = 2;

/** Said once per process: which model is grading, and whether the vendor calls it experimental. */
let modelAnnounced = false;

/** How an upload is labelled: the Blob's type and the part's filename, which must agree with the bytes. */
export interface AudioLabel {
  mime: string;
  filename: string;
}

/** A short ASCII tag at `at`, compared byte by byte without decoding anything. */
function tagAt(bytes: Uint8Array, at: number, tag: string): boolean {
  if (bytes.length < at + tag.length) return false;
  for (let i = 0; i < tag.length; i++) if (bytes[at + i] !== tag.charCodeAt(i)) return false;
  return true;
}

/**
 * Name the container from its first bytes, so the upload says what it is.
 *
 * The live tutor sends WAV, but drills and sound checks record with expo-audio's
 * HIGH_QUALITY preset: AAC in an .m4a on a phone, WebM in a browser. The token
 * server forwards those bytes unchanged, so the label has to come from the audio
 * itself. Anything unrecognised goes as octet-stream rather than a guess, and
 * the vendor's answer to it is an unscored turn like any other refusal.
 */
export function sniffAudio(bytes: Uint8Array): AudioLabel {
  if (tagAt(bytes, 0, 'RIFF') && tagAt(bytes, 8, 'WAVE')) return { mime: 'audio/wav', filename: 'utterance.wav' };
  if (tagAt(bytes, 4, 'ftyp')) return { mime: 'audio/mp4', filename: 'utterance.m4a' };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: 'audio/webm', filename: 'utterance.webm' };
  }
  if (tagAt(bytes, 0, 'OggS')) return { mime: 'audio/ogg', filename: 'utterance.ogg' };
  // An ID3 tag, or a bare MPEG frame sync: 0xFF then a byte whose top three bits are set (0xFFEx, 0xFFFx).
  if (tagAt(bytes, 0, 'ID3') || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) {
    return { mime: 'audio/mpeg', filename: 'utterance.mp3' };
  }
  return { mime: 'application/octet-stream', filename: 'audio' };
}

/** Worth one more try inside the same deadline: the vendor is overloaded or briefly down. */
function transient(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Score one utterance with TonePerfect, or return nothing.
 *
 * One Idempotency-Key per utterance, made before the first attempt and reused
 * by the retry, so a request the vendor did receive cannot bill twice. It is
 * random rather than derived from a user, session or room id, on purpose.
 *
 * Retried once on a dropped connection, a 429 or a 5xx, and only while the
 * shared deadline has not fired. Any other status is an answer and is not asked
 * again; a timeout is never retried, because the deadline is already spent.
 */
export async function scoreWithTonePerfect(req: ScoreRequest, deps: ScoreDeps = {}): Promise<PhonemeObservation[]> {
  const key = (deps.env ?? process.env).TONEPERFECT_API_KEY?.trim();
  if (!key || !req.audio || req.audio.length === 0) return [];
  const fetchFn = deps.fetchFn ?? (globalThis.fetch as unknown as ScoreFetch);
  const signal = deps.signal;

  const form = new FormData();
  const { mime, filename } = sniffAudio(req.audio);
  form.append('audio', new Blob([req.audio as BlobPart], { type: mime }), filename);
  form.append('text', req.reference);
  form.append('language', req.dialect === 'fr-ca' ? 'fr-CA' : 'fr-FR');
  // The key is a header and only a header: never in the URL, which proxies log,
  // and never in the body, which is what gets logged when a call is debugged.
  const headers = { Authorization: `Bearer ${key}`, 'Idempotency-Key': randomUUID() };
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const retryable = attempt < MAX_ATTEMPTS;
    let res: Awaited<ReturnType<ScoreFetch>>;
    try {
      res = await fetchFn(ENDPOINT, { method: 'POST', headers, body: form, ...(signal ? { signal } : {}) });
    } catch (err) {
      // A fired deadline is the router's to report, and it already has.
      if (signal?.aborted) return [];
      if (retryable) continue;
      console.warn('[toneperfect] request failed twice, so this utterance is unscored', safeError(err));
      return [];
    }

    if (!res.ok) {
      if (transient(res.status) && retryable && !signal?.aborted) continue;
      console.warn(`[toneperfect] ${res.status}, so this utterance is unscored`);
      return [];
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      if (signal?.aborted) return [];
      console.warn('[toneperfect] the response was not JSON, so this utterance is unscored', safeError(err));
      return [];
    }

    const observations = parseTonePerfect(body);
    if (observations.length > 0) {
      announceModel(body);
      console.info(`[toneperfect] scored ${observations.length} phones in ${Date.now() - startedAt} ms`);
    }
    return observations;
  }
  return [];
}

function announceModel(body: unknown): void {
  if (modelAnnounced) return;
  modelAnnounced = true;
  const model = (body as { model?: { id?: unknown; experimental?: unknown } }).model;
  const id = typeof model?.id === 'string' ? model.id : 'an unnamed model';
  console.info(`[toneperfect] scoring with ${id}, experimental: ${model?.experimental === true}`);
}

/**
 * TonePerfect's word→phone shape, flattened into our observations.
 *
 * Only a finished, assessable answer counts. `status` must be `completed` and
 * `assessable` must be literally `true`; anything else is no score, however
 * many phone scores it carries, because an assessment the vendor itself
 * disowns is not evidence about the learner.
 *
 * `raw`, `heard.phonetic_transcription`, `scores` and `model` are ignored for
 * scoring. `operation` is not consulted either: a difference between what was
 * expected and what was heard is the substitution, whatever the vendor labels it.
 */
export function parseTonePerfect(payload: unknown): PhonemeObservation[] {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    console.warn('[toneperfect] the response was not an assessment, so this utterance is unscored');
    return [];
  }
  const answer = payload as { status?: unknown; assessable?: unknown; reason?: unknown; words?: unknown };
  if (answer.status !== 'completed' || answer.assessable !== true) {
    // Keep a useful fixed category without copying arbitrary provider text.
    const reason = answer.reason === 'speech_too_short' ? 'speech_too_short' : 'unassessable';
    console.warn(`[toneperfect] not assessed (${reason}), so this utterance is unscored`);
    return [];
  }
  if (!Array.isArray(answer.words)) {
    console.warn('[toneperfect] a completed assessment with no words list; has the response shape changed?');
    return [];
  }

  const out: PhonemeObservation[] = [];
  const unknown = new Set<string>();
  let readable = 0;
  for (const w of answer.words) {
    const entry = w as { word?: unknown; text?: unknown; phones?: unknown };
    const word = typeof entry.word === 'string' && entry.word ? entry.word : typeof entry.text === 'string' ? entry.text : '';
    if (!word || !Array.isArray(entry.phones)) continue;

    for (const p of entry.phones) {
      const phone = p as { expected?: unknown; heard?: unknown; score?: unknown };
      if (typeof phone.expected !== 'string' || typeof phone.score !== 'number' || !Number.isFinite(phone.score)) continue;
      readable++;

      // Translated rather than trusted, for the reason phoneMap.ts gives: a miss
      // downstream is silent, so it is counted and said here instead.
      const ipa = toInventoryIpa(phone.expected);
      if (ipa === null) {
        unknown.add(phone.expected);
        continue;
      }
      // What the learner actually produced. Kept verbatim when it is not a
      // French phoneme: an English vowel is exactly the answer worth showing.
      const heard =
        typeof phone.heard === 'string' && phone.heard.trim() ? (toInventoryIpa(phone.heard) ?? phone.heard.trim()) : undefined;
      out.push({ ipa, score: phone.score, word, ...(heard && heard !== ipa ? { substituted: heard } : {}) });
    }
  }

  if (unknown.size > 0) {
    console.warn('[toneperfect] unknown phone symbols', { count: unknown.size });
  }
  if (answer.words.length > 0 && readable === 0) {
    console.warn('[toneperfect] a completed assessment produced no readable phones; has the response shape changed?');
  }
  return out;
}
import { safeError } from './safeError.ts';
