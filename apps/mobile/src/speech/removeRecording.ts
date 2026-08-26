/**
 * Web build: a recording is a Blob the page is holding, reached through the
 * blob: URL expo-audio made with URL.createObjectURL (AudioRecorder.web.ts).
 * Revoking that URL is the whole of "remove the recording" here: it drops the
 * last reference the document has and the bytes go with it.
 *
 * There is no file to unlink, and expo-file-system says so itself. Its web
 * build is a stub whose File constructor only warns and which carries no
 * delete method at all, so reaching for one would throw rather than clean
 * anything up. Metro picks removeRecording.native.ts on iOS and Android.
 */

/** Release one finished recording. Throws only where the platform throws. */
export function removeRecording(uri: string): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(uri);
}
