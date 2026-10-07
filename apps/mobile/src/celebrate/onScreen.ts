/**
 * Whether a celebration takeover is on screen now (come alive, retention 1.6).
 *
 * The host (`CelebrationHost.tsx`) says so whenever its one card appears or
 * goes. A screen under the takeover's Modal is still the focused screen, so
 * focus alone cannot tell it the learner is looking at something else. Home
 * reads this so its numbers tick up after the takeovers, in front of the
 * learner, rather than behind a card nobody can see through.
 *
 * A takeover is not a hold: the queue's holds pause the queue itself, and this
 * pauses nothing. Pure module state, no React, so a Node suite loads it.
 */

let onScreen = false;
const listeners = new Set<() => void>();

/** Called by the host alone, each time its card appears or goes. */
export function setTakeoverOnScreen(next: boolean): void {
  if (next === onScreen) return;
  onScreen = next;
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* A listener's failure is its own. */
    }
  }
}

/** True while a takeover card is on screen. */
export const takeoverOnScreen = (): boolean => onScreen;

/** Hear a takeover appear or go. Returns the stop. */
export function onTakeoverOnScreenChange(listener: () => void): () => void {
  const heard = (): void => listener();
  listeners.add(heard);
  return () => {
    listeners.delete(heard);
  };
}
