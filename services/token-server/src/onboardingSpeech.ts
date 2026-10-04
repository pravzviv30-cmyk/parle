import { transcribeFrenchTake } from '../../shared/transcription.ts';

interface GuestSpeechEnvironment {
  NODE_ENV?: string;
  LUVANI_LOCAL_DEVELOPMENT?: string;
  DEEPGRAM_API_KEY?: string;
}

/** A guest capability cannot authorise an authenticated paid-provider request. */
export function guestSpeechAvailable(env: GuestSpeechEnvironment): boolean {
  return env.NODE_ENV !== 'production' && env.LUVANI_LOCAL_DEVELOPMENT === '1' &&
    Boolean(env.DEEPGRAM_API_KEY?.trim());
}

/** The explicit local fixture shares the bounded, cancellable transcription adapter. */
export async function transcribeGuestTake(
  audio: Uint8Array,
  signal: AbortSignal,
  env: GuestSpeechEnvironment = process.env,
  request: typeof fetch = fetch,
): Promise<string | null> {
  if (!guestSpeechAvailable(env) || signal.aborted) return null;
  return transcribeFrenchTake(audio, { key: env.DEEPGRAM_API_KEY, signal, request });
}
