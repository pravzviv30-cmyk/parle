type Env = Record<string, string | undefined>;
type RecognitionPlan =
  | { experimental: false; options: { model: 'nova-3'; language: 'fr' | 'multi' } }
  | { experimental: true; options: { model: 'flux-general-multi'; languageHint: string[]; sampleRate: number; numerals: false } };

/** Conversation-only review candidate. Keep OFF until real learner and room QA. */
export function recognitionPlan(kind: 'convo' | 'lesson', language: 'fr' | 'multi', env: Env): RecognitionPlan {
  if (kind === 'convo' && env.LUVANI_CONVO_ASR_EXPERIMENT === '1') {
    return { experimental: true, options: {
      model: 'flux-general-multi', languageHint: ['fr', 'en'], sampleRate: 16000, numerals: false,
    } };
  }
  return { experimental: false, options: { model: 'nova-3', language } };
}
