/**
 * Stop wins: a play that was stopped while it loaded never starts.
 *
 * The recorded player sets the audio mode before it plays, and that is
 * asynchronous. Every play takes a ticket; a stop, a second play or the screen
 * going cancels every ticket handed out so far. Once the load finishes, the
 * play goes ahead only if its ticket is still the current one. The same rule
 * `speech/tutorVoice.ts` keeps with its playback generation (Phase 3 review,
 * 2026-09-27).
 *
 * Pure, so a test can open the gap between load and play and step into it.
 */

export interface PlaybackGate {
  /** A new play: cancels every earlier ticket and hands out the current one. */
  begin: () => number;
  /** Whether this ticket is still the one that may play. */
  isCurrent: (ticket: number) => boolean;
  /** Stop: no ticket handed out so far may play. */
  cancel: () => void;
}

export function createPlaybackGate(): PlaybackGate {
  let generation = 0;
  return {
    begin: () => {
      generation += 1;
      return generation;
    },
    isCurrent: (ticket) => ticket === generation,
    cancel: () => {
      generation += 1;
    },
  };
}

/**
 * Wait for `ready`, then `play` only if `ticket` is still current. Resolves to
 * whether it played. A failed load rejects, so the caller can clear its state.
 */
export async function playWhenCurrent(
  gate: PlaybackGate,
  ticket: number,
  ready: () => Promise<unknown>,
  play: () => void,
): Promise<boolean> {
  await ready();
  if (!gate.isCurrent(ticket)) return false;
  play();
  return true;
}
