/**
 * When the first run offers speaking (founder decision D13, F756). Pure.
 *
 * Guest speech has its own server admission, open only where the service says
 * so at the start of a guest practice (`speechAvailable`). Speaking is the
 * default, and "Speak instead" is offered, only when that answer was yes, the
 * practice holds a live guest capability and it is not running offline.
 * Otherwise typing comes first, and nobody lands on an unavailable microphone.
 *
 * A take the service refuses for speech (a 503 from /onboarding/audio, which
 * `guestPractice.ts` names `speech-unavailable`) moves calmly to typing: the
 * reply was not sent and no attempt was spent, so there is nothing to retry.
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

/** Whether a failed attempt was the service saying no to speech, rather than a broken connection. */
export function speechRefused(error: unknown): boolean {
  return error instanceof Error && error.message === SPEECH_UNAVAILABLE;
}
