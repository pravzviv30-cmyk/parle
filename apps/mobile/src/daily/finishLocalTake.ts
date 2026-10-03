/** Finish a local take; every failed or abandoned finish discards its bytes. */
export async function finishLocalTake(effects: {
  stop: () => Promise<void>;
  uri: () => string | null;
  resetAudio: () => Promise<void>;
  current: () => boolean;
  discard: (uri: string | null) => void;
}): Promise<string | null> {
  let recorded: string | null = null;
  let keep = false;
  let stopped = false;
  const readUri = () => { try { return effects.uri(); } catch { return null; } };
  try {
    await effects.stop();
    stopped = true;
    // Capture before the audio-mode await: resetting audio can reject even
    // though the recorder has successfully written a file.
    recorded = readUri();
    await effects.resetAudio();
    if (!effects.current()) return null;
    keep = true;
    return recorded;
  } catch (error) {
    // A timer failure must release the microphone too. Retry a refused stop
    // once, reset the mode best-effort, and preserve the original error.
    if (!stopped) { try { await effects.stop(); } catch { /* Released or refused recorder. */ } }
    await effects.resetAudio().catch(() => {});
    throw error;
  } finally {
    if (!keep) effects.discard(recorded ?? readUri());
  }
}
