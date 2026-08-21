/**
 * @parle/brain — the conversational tutor brain.
 *
 * The intelligence layer of the product: scenario roleplay, real-spoken-French
 * coaching, the scaffolding ladder extended into free conversation, and the
 * learner model. Pure and provider-neutral throughout; the `llm/` adapters are
 * the only files that know a network exists.
 *
 * The pedagogy has one implementation: the ladder itself lives in @parle/core
 * and is reused here, never copied.
 */

export * from './types.ts';
export * from './copy.ts';
export * from './frenchLeak.ts';
export * from './contract/schemas.ts';
export * from './contract/types.ts';
export * from './contract/samples.ts';
export * from './fixtures.ts';
export * from './authenticity/types.ts';
export { FR_PACK } from './authenticity/fr.ts';
export { renderAuthenticityPack } from './authenticity/render.ts';
export * from './prompt/system.ts';
export * from './prompt/turnContext.ts';
export * from './prompt/extractPrompt.ts';
export * from './curate/curate.ts';
export * from './drill/generate.ts';
export * from './prompt/historyView.ts';
export * from './prompt/scenarioPrompt.ts';
export * from './engine/grading.ts';
export * from './engine/conversation.ts';
export * from './engine/recap.ts';
export * from './profile/profile.ts';
export * from './llm/index.ts';
