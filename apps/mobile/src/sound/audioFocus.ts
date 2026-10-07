/**
 * Who has the learner's ears and voice right now. Pure: no imports, so any module or test may
 * use it (docs/come-alive/motion-sound.md section 6.4).
 *
 * Three kinds of hold, each counted, so two recorders or two voice lines never release each
 * other's focus:
 * - mic: a recorder is open (or about to be). Haptics and sound effects stay still.
 * - voice: a voice line is playing (a recorded clip, the device tutor voice), or is about to.
 *   Sound effects wait.
 * - live: a LiveKit room owns the audio session. Haptics and sound effects stay still.
 *
 * Every hold returns its own releaser, which is safe to call twice: a cleanup that runs from both
 * an unmount and a stop never takes a second hold's count away.
 *
 * The voice bridge. Entering voice playback (sound/audioSessionCore.ts) holds the voice focus
 * before the line can report that it plays, so no sound effect switches the session to the
 * silent-switch mode in that gap. At most one bridge is open, a newer play replacing it, and it
 * ends with the first of: the player's own hold (holdPlayerVoice, from useVoiceHold), the end of
 * the device voice's line that opened it (holdVoice), or the session's cap for a play that never
 * starts. A line that ends never closes a bridge a later play opened.
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

/** `onRelease` runs once, after the first release, never again on a second call. */
function hold(kind: FocusKind, onRelease?: () => void): () => void {
  counts[kind] += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    counts[kind] = Math.max(0, counts[kind] - 1);
    notify();
    onRelease?.();
  };
}

/** The voice bridge that is open, if one is, and which one it is (they are numbered as opened). */
let bridge: { release: () => void; number: number } | null = null;
let bridgesOpened = 0;

function endBridge(): void {
  const open = bridge;
  bridge = null;
  open?.release();
}

/** A recorder is open. Release on every way the recording ends. */
export const holdMic = (): (() => void) => hold('mic');
/**
 * A voice line is playing, held by its caller for the whole line: the device voice holds its line
 * and then enters voice playback. Release when it ends, stops or fails. That also ends the bridge
 * its own entry opened, the first one after this hold, and never a bridge a later play opened.
 */
export const holdVoice = (): (() => void) => {
  const own = bridgesOpened + 1;
  return hold('voice', () => {
    if (bridge?.number === own) endBridge();
  });
};
/**
 * A player reports that its voice line is playing (sound/useVoiceHold.ts). Its hold takes over from
 * the bridge, taken first so the voice focus never drops to nothing in between.
 */
export const holdPlayerVoice = (): (() => void) => {
  const release = hold('voice');
  endBridge();
  return release;
};
/**
 * Entering voice playback holds the voice focus until the line plays (see the bridge above). The
 * caller releases it at its cap; a newer bridge takes the place of an older one.
 */
export const bridgeVoice = (): (() => void) => {
  bridgesOpened += 1;
  const number = bridgesOpened;
  const release = hold('voice', () => {
    if (bridge?.number === number) bridge = null;
  });
  endBridge();
  bridge = { release, number };
  return release;
};
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
