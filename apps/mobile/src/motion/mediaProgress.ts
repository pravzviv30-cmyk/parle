/** Tracks requested positions, not the UI thread's in-flight animated value. */
export function createMediaProgressUpdates() {
  // The first update must synchronize even zero: an effect may restart with
  // another source while its shared value still holds the old source's time.
  let previousTarget: number | undefined;
  let wasMoving = false;
  return (target: number, moving: boolean): 'none' | 'animate' | 'snap' => {
    const changed = target !== previousTarget;
    const stopped = wasMoving && !moving;
    previousTarget = target;
    wasMoving = moving;
    // An unchanged playing target must not restart its interpolation. Stopping
    // still lands exactly at that target even when the audio time did not move.
    if (!changed && !stopped) return 'none';
    return moving ? 'animate' : 'snap';
  };
}
