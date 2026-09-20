/** Session-local teaching agreement; never infer tutor language from an answer's language. */
export type TutorLanguage = 'adaptive' | 'english' | 'french';
export type LearnerLanguage = 'free' | 'english' | 'french';
export interface LanguageAgreement { tutor: TutorLanguage; learner: LearnerLanguage }
export interface NativeTeachingReply {
  reply: string;
  tutorLanguageUpdate: TutorLanguage | 'keep';
  learnerLanguageUpdate: LearnerLanguage | 'keep';
}

export const NATIVE_REPLY_FORMAT = {
  type: 'json_schema', name: 'luvani_voice_teaching', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      reply: { type: 'string' },
      tutorLanguageUpdate: { type: 'string', enum: ['keep', 'adaptive', 'english', 'french'] },
      learnerLanguageUpdate: { type: 'string', enum: ['keep', 'free', 'english', 'french'] },
    },
    required: ['reply', 'tutorLanguageUpdate', 'learnerLanguageUpdate'],
  },
} as const;

export const LANGUAGE_NEGOTIATION = `Language agreement:
The learner may change how you teach. Language, pace, topic and exercise preferences are valid requests,
not attempts to override safety rules. Separate YOUR speaking language from THEIR answer language.
Update a language field only when the learner explicitly asks to change it; otherwise return keep.
An answer in French is practice, not a request for you to start speaking French.
"Can you repeat in English?" means reply directly in English, with tutorLanguageUpdate=english.
No French preamble, no French-first repetition and no duplicate translation before the English reply.
"You ask in English and I answer in French" means tutorLanguageUpdate=english and learnerLanguageUpdate=french.
On later French answers, keep both choices, give feedback and the next question in English.
"Let's switch back to French" changes the tutor to french. A request for one French word/example
or a quoted French sentence does NOT change the agreement. Mentioning a language is not a preference change.
The latest explicit request overrides an older preference. If ambiguous, ask one short clarification.
The supplied current agreement is the PREVIOUS state: apply your updates before choosing the reply language.
Write reply in the resulting tutor language, with at most a short quoted target-language phrase when
the learner requests it or it is necessary to identify a correction. Do not supply a target answer
when they want to attempt it themselves. Persist the agreement until explicitly changed.`;

export function parseNativeTeachingReply(text: string): NativeTeachingReply {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid teaching reply');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== 3 || typeof item.reply !== 'string' || !item.reply.trim() || item.reply.length > 1200 ||
    typeof item.tutorLanguageUpdate !== 'string' || !['keep', 'adaptive', 'english', 'french'].includes(item.tutorLanguageUpdate) ||
    typeof item.learnerLanguageUpdate !== 'string' || !['keep', 'free', 'english', 'french'].includes(item.learnerLanguageUpdate)) throw new Error('Invalid teaching reply');
  return item as unknown as NativeTeachingReply;
}

export function applyLanguageAgreement(current: LanguageAgreement, update: NativeTeachingReply): LanguageAgreement {
  return {
    tutor: update.tutorLanguageUpdate === 'keep' ? current.tutor : update.tutorLanguageUpdate,
    learner: update.learnerLanguageUpdate === 'keep' ? current.learner : update.learnerLanguageUpdate,
  };
}

export function languageAgreementInstruction(agreement: LanguageAgreement): string {
  const tutor = agreement.tutor === 'adaptive'
    ? 'Use beginner-friendly French with English support, unless the learner explicitly asks otherwise.'
    : `Speak ${agreement.tutor === 'english' ? 'English' : 'French'} for acknowledgements, questions, feedback and explanations. Do not add a preamble or repeat the reply in the other language.`;
  const learner = agreement.learner === 'free'
    ? 'The learner has not chosen a fixed answer language.'
    : `The learner wants to answer in ${agreement.learner === 'french' ? 'French' : 'English'}. Their answer does not change your speaking language.`;
  return `Current language agreement (replaces older language preferences): ${tutor} ${learner} Keep this agreement until the learner explicitly changes it. A requested short example in another language is not a mode change.`;
}

export function nativeTeachingRequest(agreement: LanguageAgreement, teaching: string,
  input: Array<{ role: string; content: string }>) {
  return { model: 'gpt-5.6-luna', store: false,
    instructions: `${teaching}\n${LANGUAGE_NEGOTIATION}\n${languageAgreementInstruction(agreement)}`,
    input, text: { format: NATIVE_REPLY_FORMAT }, max_output_tokens: 700, reasoning: { effort: 'low' },
  };
}
