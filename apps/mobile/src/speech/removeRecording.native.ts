/**
 * Native build: unlink the file expo-audio wrote, in the cache it wrote it to.
 *
 * expo-audio records into the app's own cache directory and never removes what
 * it wrote. Read off the SDK 57 sources rather than guessed:
 *
 *   iOS      <cache>/ExpoAudio/recording-<uuid>.m4a   AudioUtils.createRecordingUrl
 *   Android  <cache>/Audio/recording-<uuid>.m4a       AudioRecorder.createRecordingFilePath
 *
 * The API is deliberately the current one. FileSystem.deleteAsync is deprecated
 * in expo-file-system on SDK 57 and throws at runtime; it survives only behind
 * the legacy entry point, which progress/saveFile.native.ts imports and this
 * does not. new File(uri).delete() is the spelling that ships, and unlike the
 * legacy call it is synchronous.
 */

import { File } from 'expo-file-system';

/** Unlink one finished recording. Throws only where the platform throws. */
export function removeRecording(uri: string): void {
  const file = new File(uri);
  // Already gone is the goal, not a failure. A take discarded twice, or one the
  // recorder never managed to write, must not raise an alarm that means learner
  // speech is still sitting on the device.
  if (!file.exists) return;
  file.delete();
}
