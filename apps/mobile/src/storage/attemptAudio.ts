/**
 * Web build: there is no attempt audio on disk to sweep, and saying so once
 * here is cheaper than a runtime check at every call site.
 *
 * expo-audio's web recorder hands back a `blob:` URL made with
 * URL.createObjectURL (AudioRecorder.web.ts), so the recording is a Blob the
 * document is holding rather than a file in a cache directory. The page
 * releases it — speech/removeRecording.ts revokes the URL when the attempt is
 * done, and closing the tab drops whatever is left. There is nothing a later
 * sweep could find.
 *
 * expo-file-system agrees: its web build is a stub whose Directory constructor
 * only warns, with no list and no delete, so reaching for one here would throw
 * rather than clean anything up. Metro picks attemptAudio.native.ts on iOS and
 * Android, which is where the files are real.
 */

/** What one sweep did. `failed` is what makes the caller raise the alarm. */
export interface AttemptAudioSweepResult {
  /** Recordings actually removed. */
  removed: number;
  /** Recordings that are still on the device after the sweep asked them to go. */
  failed: number;
}

/** Remove every attempt recording this app left behind. Web has none. */
export function sweepAttemptAudio(): AttemptAudioSweepResult {
  return { removed: 0, failed: 0 };
}
