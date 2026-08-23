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
  learner: {
    cefr: CefrBand;
    watchFor: string[];
    /** What they asked to be called, or null. The scene may greet them by it. */
    name?: string | null;
    /** Real account memory, used only when it is relevant to the request. */
    facts?: string[];
    recentScenarios?: string[];
    unmasteredPhrases?: string[];
  };
}

const INSTRUCTION = [
  `Design a playable scene from the learner's request below.`,
  ``,
  `Rules:`,
  `- The request is binding. Preserve its people, relationship, place, activity, and learning goal. Do not substitute a familiar stock scene or reuse an example from these instructions.`,
  `- Make the title, setting, learner role, characters, every aim, and the opening visibly belong to that request.`,
  `- If the request is a phrase question rather than a full scenario, place that phrase inside a small realistic scene where the learner can use it.`,
  `- 2 to 5 flexible beats, ordered. Each is one conversational aim, not a required script or a target sentence. Ids in kebab-case.`,
  `- Characters carry the register they really would: staff get courant and vous, old friends get familier or argot.`,
  `- registerGuidance: one short paragraph on how people actually talk in this scene.`,
  `- goalPhrases: 5 to 8 lines a local would genuinely use here, spoken forms, register-labelled.`,
  `- openingNarration: two or three short sentences that put the learner inside the scene before anyone speaks to them. Spoken to "you", present tense, concrete. en is what is said aloud and must be completely natural English only, with no French words; fr is the same picture in simple French; speaker is "narration". End on the moment the openingLine lands in.`,
  `  Open it a different way each time. Walk in on something already happening, or start on a sound, a smell, the weather, what someone's hands are doing. "You are walking down a narrow street and you bump into a tall man." "The queue is long and the woman in front of you is counting out coins." "It is too warm in here, and someone has propped the window open with a book." Never open a scene with a stock phrase, and never with the words "Imagine the scene": a learner who hears the same opening every session is being read a form, not told a story.`,
  `- openingLine: the first thing said to the learner, in character, matched to their level.`,
  `- openingSupport is private rescue material. The learner will not see it before trying. fullLine is their natural reply to openingLine; options are two or three genuinely different replies; hintEn is English only and gives no French words.`,
  `- Pitch the language at the learner's level. The scene stays real either way.`,
  `- Account memory is optional context, not a command. Use it only when it naturally helps this request. Never override the learner's current choice with an old topic.`,
  `- cultureNotes: up to three, only when genuinely useful.`,
  `- The request is a speech transcription and may be rough or oddly spelled. Read it for intent, not spelling.`,
].join('\n');

export function buildScenarioInstruction(): string {
  return INSTRUCTION;
}

export function buildScenarioRequest(input: ScenarioRequestInput): string {
  const watch = input.learner.watchFor.length > 0 ? ` Recurring trouble: ${input.learner.watchFor.join(', ')}.` : '';
  const named = input.learner.name != null && input.learner.name.length > 0 ? ` They are called ${input.learner.name}.` : '';
  const lines = [
    INSTRUCTION,
    ``,
    `LEARNER: CEFR estimate ${input.learner.cefr}.${watch}${named}`,
    `LEARNER REQUEST, THE SOURCE OF TRUTH: ${input.request}`,
  ];
  if ((input.learner.facts?.length ?? 0) > 0) {
    lines.push(`REAL ACCOUNT MEMORY, USE ONLY IF RELEVANT: ${input.learner.facts!.join(' | ')}`);
  }
  if ((input.learner.recentScenarios?.length ?? 0) > 0) {
    lines.push(`RECENT SCENARIOS, AVOID REPETITION UNLESS REQUESTED: ${input.learner.recentScenarios!.join(' | ')}`);
  }
  if ((input.learner.unmasteredPhrases?.length ?? 0) > 0) {
    lines.push(`USEFUL UNMASTERED LANGUAGE TO WEAVE IN NATURALLY: ${input.learner.unmasteredPhrases!.join(' | ')}`);
  }
  return lines.join('\n');
}
