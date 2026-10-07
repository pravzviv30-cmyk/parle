/**
 * When the first run offers speaking (founder decision D13, F756). Pure.
 *
 * Guest speech has its own server admission, open only where the service says
 * so at the start of a guest practice (`speechAvailable`). Speaking is the
 * default, and "Speak instead" is offered, only when that answer was yes, the
 * practice holds a live guest capability and it is not running offline.
 * Otherwise typing comes first, and nobody lands on an unavailable microphone.
 *
 * A take the service refuses for speech moves calmly to typing: guest speech
 * is closed or its budget is full, so the take was never transcribed and no
 * attempt was spent, and there is nothing to retry. Only the service's own
 * words for that refusal mean it (`starterFailure`). A failed transcription is
 * a 503 from the same path, but it comes after the attempt was reserved, so it
 * reads as a broken connection, with Try again, and never as speech closed.
 */

export interface SpeechFacts {
  readonly speechAvailable?: boolean;
  readonly token: string | null;
  readonly offline?: boolean;
}

/** True only when the server said guest speech is available for this live practice. */
export function speakingOffered(guest: SpeechFacts | null | undefined): boolean {
  return guest != null && guest.speechAvailable === true && guest.token != null && guest.offline !== true;
}

/** How a fresh practice opens: speaking when it is offered, typing otherwise. */
export function startMode(guest: SpeechFacts | null | undefined): 'spoken' | 'typed' {
  return speakingOffered(guest) ? 'spoken' : 'typed';
}

/** The error `sendGuestAttempt` throws when the service refuses a take for speech. */
export const SPEECH_UNAVAILABLE = 'speech-unavailable';

/**
 * What the token server says, word for word, when guest speech is closed or a
 * budget is full: before any attempt is reserved and before any transcription
 * (services/token-server/src/server.ts, /onboarding/audio).
 */
export const SPEECH_CLOSED = 'guest speech unavailable; type instead';

/**
 * The error a failed starter request throws, from its status, its path and the
 * error the service named in its body: 'expired', 'limit', `SPEECH_UNAVAILABLE`
 * only for the speech refusal itself, and 'unavailable' for everything else,
 * a failed transcription included.
 */
export function starterFailure(status: number, path: string, said: unknown): string {
  if (status === 410) return 'expired';
  if (status === 409) return 'limit';
  if (status === 503 && path === 'audio' && said === SPEECH_CLOSED) return SPEECH_UNAVAILABLE;
  return 'unavailable';
}

/** Whether a failed attempt was the service saying no to speech, rather than a broken connection. */
export function speechRefused(error: unknown): boolean {
  return error instanceof Error && error.message === SPEECH_UNAVAILABLE;
}
