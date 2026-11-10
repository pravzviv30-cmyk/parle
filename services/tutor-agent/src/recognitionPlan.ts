type Env = Record<string, string | undefined>;
type RecognitionPlan =
  | { flux: true; options: { model: 'flux-general-multi'; languageHint: string[]; sampleRate: number; numerals: false; eotTimeoutMs: number } }
  | { flux: false; options: { model: 'nova-3'; language: 'fr' | 'multi' } };

/** Flux for every session kind (F964); LUVANI_STT_NOVA_KINDS (comma list) puts a kind back on Nova-3. */
export function recognitionPlan(kind: 'convo' | 'lesson' | 'scene', language: 'fr' | 'multi', env: Env): RecognitionPlan {
  if ((env.LUVANI_STT_NOVA_KINDS ?? '').split(',').some((name) => name.trim() === kind)) {
    return { flux: false, options: { model: 'nova-3', language } };
  }
  return { flux: true, options: { model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, numerals: false, eotTimeoutMs: 3000 } };
}
