/**
 * The post-session memory call — the question a good tutor asks themselves
 * after a lesson: what did I learn about this person?
 *
 * Runs once, after the recap has already shipped, off every critical path.
 * The one hard problem is fiction: the learner spends the whole session
 * playing a role, and a scene where they "ordered a coffee in Lyon" is not a
 * fact about their life. The instruction draws that line explicitly and tells
 * the model to drop anything it is unsure of — a missed fact costs nothing, an
 * invented one greets the learner next session with a life they never had.
 */

import type { ChatMessage } from '../llm/client.ts';
import type { MemoryFact } from '../contract/types.ts';
import { PERSONAL_MEMORY_RULE } from './memoryPolicy.ts';

export interface ExtractionInput {
  /** The session transcript, as the engine recorded it. */
  history: readonly ChatMessage[];
  /** Facts already on file, so nothing is re-extracted or contradicted blindly. */
  knownFacts: readonly MemoryFact[];
}

const INSTRUCTION = [
  `The session below has ended. Answer one question: what important information have we learned about the learner as a real person?`,
  ``,
  `Rules:`,
  PERSONAL_MEMORY_RULE,
  `- Facts only about their actual life: interests they showed, events coming up, goals, preferences about how they like to practise. Kinds: interest, life-event, goal, preference.`,
  `- The scene was fiction and they were playing a part. Nothing that happened inside the scene is a fact about them. What they volunteered around it is: the topic they chose, an aside about their week, a question about their own trip to Paris.`,
  `- When you are not sure a thing is real, leave it out. An invented fact is far worse than a missed one.`,
  `- en is one short plain sentence; fr is the same fact in simple French when it translates naturally, else null; happensAround is a loose when ("Tuesday", "next month") or null.`,
  `- Do not repeat facts already on file below. An updated version of one is fine.`,
  `- openerFr and openerEn: ONE short line to open the NEXT session with, referencing something real from this one, ending in a question they can answer. openerEn is the version that will be SPOKEN aloud — write it as natural spoken English ("So, how did that interview go?"), never as a gloss of the French. openerFr is the same opener in simple French, shown on screen. Null when nothing real surfaced. Never reference the scene's fiction.`,
].join('\n');

function factLine(fact: MemoryFact): string {
  const when = fact.happensAround === null ? '' : ` (${fact.happensAround})`;
  return `- [${fact.kind}] ${fact.en}${when}`;
}

export function buildExtractionRequest(input: ExtractionInput): string {
  const lines: string[] = [INSTRUCTION, ``];
  if (input.knownFacts.length > 0) {
    lines.push('Already on file:', ...input.knownFacts.map(factLine), '');
  }
  lines.push('TRANSCRIPT');
  for (const message of input.history) {
    // The trailing role marker is enough; the model saw this conversation
    // from the inside and only needs to be reminded who said what.
    const who = message.role === 'user' ? 'learner' : message.role === 'assistant' ? 'tutor' : 'app';
    lines.push(`${who}: ${message.text}`);
  }
  return lines.join('\n');
}
