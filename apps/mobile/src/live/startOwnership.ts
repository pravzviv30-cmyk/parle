/**
 * Which attempt at starting a session still owns the screen.
 *
 * Opening a session is a chain of awaits — auth, the token, the audio session,
 * the room, the microphone — and a cold start can spend twenty five seconds in
 * it. The learner is allowed to leave in the middle of that, navigation is
 * allowed to pop the screen, and a second start is allowed to begin. None of
 * those stops the chain: the token fetch resolves anyway, and the code after it
 * happily builds a Room, connects it and publishes a microphone for a screen
 * that is gone.
 *
 * That is not a cosmetic leak. A connected room is a room the tutor is
 * dispatched into, and the tutor is what costs money: it waits for the
 * participant, finds one (the ghost connection IS the learner's participant),
 * teaches nobody for up to fifteen minutes, and debits those minutes from the
 * learner's allowance. The microphone stays published the whole time.
 *
 * So every start takes a number, and only the highest number owns the session.
 * A start that looks up and finds a newer number gives back exactly what it
 * built — the room it opened, the audio session it took — and writes nothing
 * else, because the refs and the state it would write to belong to whoever owns
 * the session now.
 *
 * A counter rather than an AbortController because that is how the rest of the
 * hook already works: the session's identity lives in refs that closures read
 * at the moment they run. It also answers the question an AbortController
 * cannot answer on its own, which is not "was this cancelled" but "is this
 * still the current one" — the difference between the two is a second start
 * quietly clobbering the first one's room.
 */

/** No start has been made yet. */
export const NO_START = 0;

/**
 * The number the next start takes.
 *
 * Also the number that abandons whatever is in flight: leaving, unmounting and
 * starting again are all the same act from here, which is taking the session
 * away from the attempt that was building it.
 */
export function nextStart(current: number): number {
  return current + 1;
}

/** Is this the start the screen is still waiting for? */
export function startStillOwns(mine: number, current: number): boolean {
  return mine === current;
}

/** What a start is holding when it stops to ask whether it is still wanted. */
export interface StartHolds {
  /** `new Room()` has run, so there is something to disconnect. */
  room: boolean;
  /** The OS audio session was taken, so it has to be given back. */
  audioSession: boolean;
}

/** What an abandoned start has to undo before it returns. */
export interface StandDown {
  /**
   * Disconnect the room. This is the one that stops the meter: it also stops
   * the local tracks, so the microphone closes with it.
   */
  disconnectRoom: boolean;
  /** Hand the audio session back to the OS. */
  releaseAudioSession: boolean;
}

/**
 * Null while this start still owns the session, and otherwise the list of
 * things it must give back.
 *
 * Deliberately says nothing about the shared refs or the screen's state. An
 * abandoned start writes to neither: either the learner has left, in which case
 * `leave` has already emptied them, or a newer start is using them, in which
 * case writing is exactly the clobber this exists to prevent.
 */
export function standDown(mine: number, current: number, holds: StartHolds): StandDown | null {
  if (startStillOwns(mine, current)) return null;
  return { disconnectRoom: holds.room, releaseAudioSession: holds.audioSession };
}
