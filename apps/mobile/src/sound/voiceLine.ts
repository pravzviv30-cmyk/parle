/**
 * When a tapped voice sample starts. Pure: no imports, so the tests run it.
 *
 * The caller enters voice playback first (sound/audioSession.ts), which at once pauses any sound
 * effect and opens the voice bridge, then hands over the promise it returned:
 * - On a phone the line waits for the full voice mode, so it is heard with the silent switch on
 *   (F723).
 * - On the web there are no audio modes (`setAudioModeAsync` does nothing there), and iOS Safari
 *   lets a page play only inside the tap that asked. Waiting for the promise moves the play out of
 *   the tap, so there the line starts at once.
 */
export function startVoiceLine(ready: Promise<unknown>, start: () => void, web: boolean): void {
  if (web) {
    start();
    return;
  }
  void ready.then(start);
}
