/**
 * The session-start call that turns a freeform request into a playable scene.
 *
 * Reuses the cached persona + pack blocks; the frame-specific briefing rides
 * in the user message so the prefix cache still hits. The learner picture is
 * summarized, not dumped — the frame call needs pitch, not history.
 */

import type { CefrBand } from '../types.ts';

export interface ScenarioRequestInput {
  /** The learner's freeform ask, English or French. */
  request: string;
  learner: { cefr: CefrBand; watchFor: string[] };
}

const INSTRUCTION = [
  `Design a playable scene from the learner's request below.`,
  ``,
  `Rules:`,
  `- The request is binding. Preserve its people, relationship, place, activity, and learning goal. Do not substitute a familiar stock scene or reuse an example from these instructions.`,
  `- Make the title, setting, learner role, characters, every beat, and the opening visibly belong to that request. If they ask to drive with friends and discuss what they see, the learner is driving with friends and the beats teach that conversation.`,
  `- 3 to 6 beats, ordered. Each is one small conversational goal, with a French goal and an English gloss. Ids in kebab-case.`,
  `- Characters carry the register they really would: staff get courant and vous, old friends get familier or argot.`,
  `- registerGuidance: one short paragraph on how people actually talk in this scene.`,
  `- goalPhrases: 5 to 8 lines a local would genuinely use here, spoken forms, register-labelled.`,
  `- openingNarration: two or three short sentences that put the learner inside the scene before anyone speaks to them. Spoken to "you", present tense, concrete: "Imagine the scene. You are walking down a narrow street, and you bump into a tall man." en is what is said aloud; fr is the same picture in simple French; speaker is "narration". End on the moment the openingLine lands in.`,
  `- openingLine: the first thing said to the learner, in character, matched to their level.`,
  `- openingSupport: for a learner with no words yet. fullLine is the natural reply to the openingLine; options are two or three short different replies; hintEn is English only, no French words.`,
  `- Pitch the language at the learner's level. The scene stays real either way.`,
  `- cultureNotes: up to three, only when genuinely useful.`,
  `- The request is a speech transcription and may be rough or oddly spelled. Read it for intent, not spelling.`,
].join('\n');

export function buildScenarioInstruction(): string {
  return INSTRUCTION;
}

export function buildScenarioRequest(input: ScenarioRequestInput): string {
  const watch = input.learner.watchFor.length > 0 ? ` Recurring trouble: ${input.learner.watchFor.join(', ')}.` : '';
  return [
    INSTRUCTION,
    ``,
    `LEARNER: CEFR estimate ${input.learner.cefr}.${watch}`,
    `LEARNER REQUEST, THE SOURCE OF TRUTH: ${input.request}`,
  ].join('\n');
}
