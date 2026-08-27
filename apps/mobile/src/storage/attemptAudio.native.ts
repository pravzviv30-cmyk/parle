/**
 * Native build: empty the two cache directories expo-audio records into.
 *
 * The per-attempt discard in speech/discardRecording.ts is the fix; this is the
 * backstop, and it exists because the discard has three ways of never running.
 * The app can be killed between `stop()` and the delete. A build that shipped
 * before the discard existed left every attempt a learner ever made sitting in
 * the cache, and upgrading does not remove them. And a path nobody thought of
 * is, by definition, one nobody will notice. So a learner who clears their data
 * gets the disk swept whether or not each attempt cleaned up after itself.
 *
 * The directory names are read off the SDK 57 sources, not guessed. Both
 * screens record with `RecordingPresets.HIGH_QUALITY`, which sets no
 * `directory`, so both platforms take the CACHE default:
 *
 *   iOS      <cache>/ExpoAudio/recording-<uuid>.m4a   AudioUtils.createRecordingUrl
 *   Android  <cache>/Audio/recording-<uuid>.m4a       AudioRecorder.createRecordingFilePath
 *
 * Both are created on demand on every single recording (`ensureDirExists`), so
 * emptying one costs the next attempt nothing.
 *
 * **The cache root is not swept, deliberately.** `progress/saveFile.native.ts`
 * writes the Anki export straight into `<cache>`, and a learner who exported
 * their deck and has not opened the share sheet yet would lose it. Expo keeps
 * its own things there too. Only the two directories above are ours, and only
 * their contents go.
 *
 * The API is the current one. `FileSystem.deleteAsync` is deprecated in
 * expo-file-system on SDK 57 and throws at runtime; it survives only behind the
 * `expo-file-system/legacy` entry point. `Directory.list()` and `delete()` are
 * the spelling that ships, and both are synchronous.
 */

import { Directory, Paths } from 'expo-file-system';

/** What one sweep did. `failed` is what makes the caller raise the alarm. */
export interface AttemptAudioSweepResult {
  /** Recordings actually removed. */
  removed: number;
  /** Recordings that are still on the device after the sweep asked them to go. */
  failed: number;
}

/**
 * The cache subdirectories expo-audio writes recordings into, one per platform.
 * Sweeping both on both platforms is one wasted `exists` check and means an
 * upgrade that changes which name is used cannot silently strand the other.
 */
const RECORDING_DIRECTORIES = ['ExpoAudio', 'Audio'] as const;

/**
 * Remove every attempt recording this app left behind.
 *
 * Never throws. One stubborn file must not stop the rest from going, and a
 * sweep that failed must not take the data reset down with it — so every
 * failure is counted and returned instead, and `clearActiveUserData` turns a
 * non-zero count into a loud line rather than a crash.
 */
export function sweepAttemptAudio(): AttemptAudioSweepResult {
  let removed = 0;
  let failed = 0;

  for (const name of RECORDING_DIRECTORIES) {
    let entries: { delete(): void }[];
    try {
      const directory = new Directory(Paths.cache, name);
      // Never recorded on this platform, or already swept. Not a failure: a
      // directory that is not there is the state this function is asking for.
      if (!directory.exists) continue;
      entries = directory.list();
    } catch {
      // The listing itself failed, so we cannot even say what is left. Count it
      // once, because the honest claim is "something may still be there".
      failed += 1;
      continue;
    }

    for (const entry of entries) {
      try {
        entry.delete();
        removed += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { removed, failed };
}
