import { transcribeFrenchTakeMeasured } from '../../shared/transcription.ts';
import { decodeAudio, pcmWav, reserveGuestDecoder, type DecoderReservation, type DecodedAudio } from '../../shared/audioDecode.ts';
import { claimGuestSpeech, GUEST_SPEECH_LIMITS, type GuestSpeechLimits, type GuestSpeechReservation } from './guestSpeechAdmission.ts';

export interface GuestSpeechEnvironment {
  NODE_ENV?: string;
  LUVANI_LOCAL_DEVELOPMENT?: string;
  DEEPGRAM_API_KEY?: string;
  LUVANI_GUEST_SPEECH?: string;
  LUVANI_GUEST_SPEECH_DAILY_SECONDS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  LUVANI_AUDIO_DECODER_PATH?: string;
  LUVANI_AUDIO_DECODER_SHA256?: string;
}

const MAX_DAILY_SECONDS = 86_400;

/** The service-wide daily ceiling: the conservative default, or a whole number from 1 to 86,400. Anything else is null. */
export function guestSpeechDailySeconds(env: GuestSpeechEnvironment): number | null {
  const raw = env.LUVANI_GUEST_SPEECH_DAILY_SECONDS?.trim();
  if (!raw) return GUEST_SPEECH_LIMITS.globalDailySeconds;
  if (!/^[1-9][0-9]{0,5}$/.test(raw)) return null;
  const seconds = Number(raw);
  return seconds <= MAX_DAILY_SECONDS ? seconds : null;
}

export function guestSpeechLimits(env: GuestSpeechEnvironment): GuestSpeechLimits {
  return { ...GUEST_SPEECH_LIMITS, globalDailySeconds: guestSpeechDailySeconds(env) ?? GUEST_SPEECH_LIMITS.globalDailySeconds };
}

/**
 * What production guest speech still lacks, by name. Empty means it is open.
 *
 * A key alone opens nothing, and local flags never open production. Production
 * needs the explicit switch, the speech key, the durable shared store that holds
 * the admission budgets, the reviewed decoder that measures a take before it is
 * sent, and a valid daily ceiling.
 */
export function guestSpeechGaps(env: GuestSpeechEnvironment): string[] {
  const gaps: string[] = [];
  if (!env.DEEPGRAM_API_KEY?.trim()) gaps.push('DEEPGRAM_API_KEY');
  if (guestSpeechDailySeconds(env) === null) gaps.push('LUVANI_GUEST_SPEECH_DAILY_SECONDS');
  if (env.NODE_ENV !== 'production') {
    if (env.LUVANI_LOCAL_DEVELOPMENT !== '1') gaps.push('LUVANI_LOCAL_DEVELOPMENT');
    return gaps;
  }
  if (env.LUVANI_LOCAL_DEVELOPMENT === '1') gaps.push('production without LUVANI_LOCAL_DEVELOPMENT');
  if (env.LUVANI_GUEST_SPEECH !== '1') gaps.push('LUVANI_GUEST_SPEECH');
  if (!env.UPSTASH_REDIS_REST_URL?.trim() || !env.UPSTASH_REDIS_REST_TOKEN?.trim()) gaps.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  if (!env.LUVANI_AUDIO_DECODER_PATH?.trim() || !env.LUVANI_AUDIO_DECODER_SHA256?.trim()) gaps.push('LUVANI_AUDIO_DECODER_PATH and LUVANI_AUDIO_DECODER_SHA256');
  return gaps;
}

/** Whether guest speech is configured at all. Each take still needs its own admission. */
export function guestSpeechAvailable(env: GuestSpeechEnvironment): boolean {
  return guestSpeechGaps(env).length === 0;
}

export interface GuestSpeechVendor {
  request?: typeof fetch;
  decode?: typeof decodeAudio;
}

/**
 * Anonymous guests share this process's two audio decoders with paid scoring and
 * paid transcription, which answer nothing when both are busy. A guest take may
 * hold one at most, so a flood of guests can never take the last.
 */


/**
 * One admitted take, transcribed at most once and settled exactly once.
 *
 * Without a reservation issued by the guest admission, nothing is sent. In
 * production the take is decoded first and cut to the reserved seconds, so the
 * vendor never receives more than was booked and the settlement is the exact
 * duration sent. Locally the vendor's reported duration settles it. A take that
 * never reached the vendor returns its whole reservation; a take that reached it
 * with no measurement keeps it.
 */
export async function transcribeGuestTake(
  audio: Uint8Array,
  admitted: GuestSpeechReservation,
  signal: AbortSignal,
  env: GuestSpeechEnvironment = process.env,
  vendor: GuestSpeechVendor = {},
  decoderReservation?: DecoderReservation,
): Promise<string | null> {
  const reserved = claimGuestSpeech(admitted);
  if (reserved === null) return null;
  let used = 0;
  let decoderLease = decoderReservation;
  try {
    if (!guestSpeechAvailable(env) || signal.aborted) return null;
    let take = audio;
    let measured: number | null = null;
    if (env.NODE_ENV === 'production') {
      // A busy guest decoder sends nothing, so the reservation comes back whole.
      decoderLease ??= reserveGuestDecoder() ?? undefined;
      if (!decoderLease) return null;
      const decoder = { LUVANI_AUDIO_DECODER_PATH: env.LUVANI_AUDIO_DECODER_PATH, LUVANI_AUDIO_DECODER_SHA256: env.LUVANI_AUDIO_DECODER_SHA256 };
      let decoded: DecodedAudio;
      try { decoded = await (vendor.decode ?? decodeAudio)(audio, { env: decoder, signal, reservation: decoderLease }); } finally { decoderLease.release(); }
      const pcm = decoded.wav.subarray(44, 44 + reserved * 32_000);
      take = pcmWav(pcm);
      measured = pcm.length / 32_000;
    }
    const result = await transcribeFrenchTakeMeasured(take, {
      key: env.DEEPGRAM_API_KEY, signal, ...(vendor.request ? { request: vendor.request } : {}),
    });
    if (result.dispatched) used = Math.max(1, measured ?? result.seconds ?? reserved);
    return result.transcript;
  } catch {
    return null;
  } finally {
    decoderLease?.release();
    await admitted.settle(used);
  }
}
