import { recorderUri } from '../daily/recorderUri.ts';

/** Stop an abandoned sound-check take, even after Expo releases its recorder. */
export async function abandonSoundCheckRecording(
  recorder: { readonly uri: string | null },
  stop: () => Promise<void>,
  fallback: string | null,
  discard: (uri: string | null) => void,
  resetAudio: () => Promise<void>,
): Promise<void> {
  const abandoned = recorderUri(recorder, fallback);
  try {
    // The awaited call also catches a synchronous throw from a released native
    // recorder. Its cached URI must still be discarded in finally.
    await stop();
  } catch {
    // A failed stop can still have made a temporary file.
  } finally {
    discard(abandoned);
    discard(recorderUri(recorder, abandoned));
    await resetAudio().catch(() => undefined);
  }
}
