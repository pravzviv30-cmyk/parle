/**
 * When the recap may have the learner's ears back (F763).
 *
 * A conversation's recap renders inside the room it ended in, because the
 * agent's enriched profile and tonight's drills arrive over that room seconds
 * later. The room holds the audio focus from the moment it takes the audio
 * session (`live/globals.ts`, `sound/audioFocus.ts`), so while it is open no
 * sound effect plays and no control gives a haptic: decision D8, a live room is
 * silent and still. Held until `leave()`, that rule also silenced the recap,
 * which is the one moment in a conversation meant to be felt.
 *
 * So the hold goes early, and only once all four of these are true:
 * - the recap has arrived, so the session is over;
 * - the microphone is closed, confirmed rather than asked for;
 * - the tutor is not speaking, so nothing can cut across a line still playing;
 * - the session was not stopped for safety (F137). A stop gets no moment, and
 *   its message may still be playing out when the recap arrives.
 *
 * Releasing the hold changes nothing in the room itself. LiveKit's audio
 * session stays up until `leave()`, as it always has.
 */

export interface RecapAudio {
  /** The recap message has arrived: the session has ended. */
  recapArrived: boolean;
  /** `setMicrophoneEnabled(false)` resolved after the recap arrived. */
  micClosed: boolean;
  tutorSpeaking: boolean;
  /** The tutor stopped this session for safety. */
  stopped: boolean;
}

export function recapMayTakeTheAudio(state: RecapAudio): boolean {
  return state.recapArrived && state.micClosed && !state.tutorSpeaking && !state.stopped;
}
