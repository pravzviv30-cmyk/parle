/**
 * Where a recording's life on this device ends.
 *
 * DrillScreen and SoundCheckScreen both record through expo-audio, read
 * recorder.uri and hand the bytes up to be scored. Nothing used to remove them
 * afterwards, so every spoken attempt left an m4a in the app's cache, and
 * clearing a learner's data never touched it: deleting the account took the
 * server rows and left the voice on the phone. PRIVACY_AND_SAFETY.md says raw
 * learner speech is never stored. This is the file that makes that true of the
 * disk and not only of the store.
 *
 * Three rules hold it together, and the second is the one that is easy to get
 * wrong in the direction nobody notices.
 *
 * **After, never before.** The scorer reads the file off disk. A discard that
 * runs while the upload is still reading turns a scored attempt into an
 * unscored one, silently, and only under bad network. So consumeRecording waits
 * for its consumer to finish before it removes anything.
 *
 * **Every exit, not just the good one.** Assessment needs a vendor key the
 * default install does not have, and scoreRecordedAttempt answers null rather
 * than inventing a result, so the ordinary case is a recording nothing ever
 * looked at. That is still a recording on disk. So is a refused upload, a
 * thrown one, and a take that arrived after the drill had already moved on.
 *
 * **A failed discard costs the learner nothing.** The bytes matter less than
 * the attempt, so the error is swallowed and the beat carries on. Not quietly,
 * though: RECORDING_NOT_DISCARDED goes out in the shape sync and the agent
 * already use, because it means speech that should have gone is still there.
 *
 * The two effects are injected, which is what lets this policy be tested
 * without a device. Their defaults are the real ones: the platform pair in
 * removeRecording.ts, and the console.
 */

import { removeRecording } from './removeRecording.ts';

/** How a recording actually leaves the device. */
export type RecordingRemover = (uri: string) => void;

/** The two effects, so a test can watch them and a screen can ignore them. */
export interface DiscardHooks {
  remove?: RecordingRemover;
  alarm?: (line: string) => void;
}

/**
 * One greppable line, the way SYNC_NOT_CONVERGED is one. It carries no path on
 * purpose: that a discard failed is the entire signal, and a device path is the
 * kind of thing that ends up pasted into a support ticket.
 */
export const RECORDING_NOT_DISCARDED = '[parle] RECORDING_NOT_DISCARDED';

/** Remove one finished recording. Never throws, whatever the platform does. */
export function discardRecording(uri: string | null, hooks: DiscardHooks = {}): void {
  if (uri === null || uri === '') return;
  const remove = hooks.remove ?? removeRecording;
  try {
    remove(uri);
  } catch {
    (hooks.alarm ?? ((line: string): void => console.error(line)))(RECORDING_NOT_DISCARDED);
  }
}

/**
 * Hand a recording to whatever consumes it, then discard it.
 *
 * `use` runs to completion first. After that the file goes, whether `use`
 * returned a score, returned null because scoring is off or the server refused,
 * or threw on the way. A null uri means the recorder lost the take and there is
 * nothing here to consume or to remove.
 */
export async function consumeRecording<T>(
  uri: string | null,
  use: (uri: string) => Promise<T>,
  hooks: DiscardHooks = {},
): Promise<T | null> {
  if (uri === null || uri === '') return null;
  try {
    return await use(uri);
  } finally {
    discardRecording(uri, hooks);
  }
}
