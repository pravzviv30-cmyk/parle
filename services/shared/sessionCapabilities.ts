/** Explicit degraded runtime; never infer healthy speech from a present key. */
type Env = Record<string, string | undefined>;
export const typedOnly = (env: Env = process.env): boolean => env.LUVANI_TYPED_ONLY === '1';
export function supportedSessionModes(env: Env = process.env): readonly string[] {
  return typedOnly(env) ? ['lesson-text', 'convo-text'] : ['lesson', 'lesson-text', 'convo', 'convo-text'];
}
export function supportsSessionMode(mode: unknown, env: Env = process.env): boolean {
  return typeof mode === 'string' && supportedSessionModes(env).includes(mode);
}
/** A typed room constructs no vendor speech clients and opts out of SDK default VAD. */
export function sessionAudio<Vad, Stt, Tts>(voiceless: boolean, factories: { vad: () => Vad; stt: () => Stt; tts: () => Tts }): { vad: Vad | null; stt: Stt | undefined; tts: Tts | undefined } {
  return voiceless ? { vad: null, stt: undefined, tts: undefined } : { vad: factories.vad(), stt: factories.stt(), tts: factories.tts() };
}
