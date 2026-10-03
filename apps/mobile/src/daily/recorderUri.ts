/** Expo releases its recorder before late promises necessarily settle. */
export function recorderUri(recorder: { readonly uri: string | null }, fallback: string | null): string | null {
  try { return recorder.uri ?? fallback; } catch { return fallback; }
}
