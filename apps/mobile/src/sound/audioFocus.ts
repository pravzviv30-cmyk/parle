/**
 * Who has the learner's ears and voice right now. Pure: no imports, so any module or test may
 * use it (docs/come-alive/motion-sound.md section 6.4).
 *
 * Three kinds of hold, each counted, so two recorders or two voice lines never release each
 * other's focus:
 * - mic: a recorder is open (or about to be). Haptics and sound effects stay still.
 * - voice: a voice line is playing (a recorded clip, the device tutor voice). Sound effects wait.
 * - live: a LiveKit room owns the audio session. Haptics and sound effects stay still.
 *
 * Every hold returns its own releaser, which is safe to call twice: a cleanup that runs from both
 * an unmount and a stop never takes a second hold's count away.
 */

export type FocusKind = 'mic' | 'voice' | 'live';
export type FocusListener = () => void;

const counts: Record<FocusKind, number> = { mic: 0, voice: 0, live: 0 };
const listeners = new Set<FocusListener>();

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* A listener's failure is its own. */
    }
  }
}

function hold(kind: FocusKind): () => void {
  counts[kind] += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts[kind] = Math.max(0, counts[kind] - 1);
    notify();
  };
}

/** A recorder is open. Release on every way the recording ends. */
export const holdMic = (): (() => void) => hold('mic');
/** A voice line is playing. Release when it ends, stops or fails. */
export const holdVoice = (): (() => void) => hold('voice');
/** A live room owns the audio session. Release when the session is given back. */
export const holdLive = (): (() => void) => hold('live');

export const micLive = (): boolean => counts.mic > 0;
export const voiceBusy = (): boolean => counts.voice > 0;
export const liveRoom = (): boolean => counts.live > 0;
/** Any hold at all: a sound effect may not take the audio session from it. */
export const anyHold = (): boolean => counts.mic + counts.voice + counts.live > 0;

/** Called after every hold and every release. Returns the unsubscribe. */
export function subscribe(listener: FocusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
