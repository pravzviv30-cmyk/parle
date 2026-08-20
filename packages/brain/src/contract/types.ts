/**
 * Types inferred from the contract schemas, plus the shapes that are built by
 * code rather than by the model (views, the recap). One source of truth: if it
 * crosses the model boundary it is inferred from a schema; if code assembles
 * it, it lives here.
 */

import type { z } from 'zod/v4';
import type {
  CoachItemZ,
  MemoryExtractionSchema,
  MemoryFactZ,
  NewPhraseZ,
  ScenarioFrameSchema,
  SupportZ,
  TurnSchema,
} from './schemas.ts';
import type { CefrBand } from '../types.ts';

export type TutorTurn = z.infer<typeof TurnSchema>;
export type ScenarioFrame = z.infer<typeof ScenarioFrameSchema>;
export type CoachItem = z.infer<typeof CoachItemZ>;
export type CoachKind = CoachItem['kind'];
export type NewPhrase = z.infer<typeof NewPhraseZ>;
export type Assessment = TutorTurn['assessment'];
export type SupportMaterial = z.infer<typeof SupportZ>;
export type SpeakerLine = TutorTurn['sceneReply'];
export type MemoryFact = z.infer<typeof MemoryFactZ>;
export type MemoryExtraction = z.infer<typeof MemoryExtractionSchema>;

/**
 * What the UI renders as on-screen support this turn. Deliberately shaped like
 * core's scripted SupportView (minus IPA, which free conversation does not
 * carry), so a future app screen renders both modes with one component.
 */
export type SupportView =
  | { kind: 'full-line'; line: string; written: string | null; gloss: string }
  | { kind: 'options'; options: { text: string; en: string }[] }
  | { kind: 'hint'; hint: string }
  | { kind: 'none' };

/**
 * The end card. Assembled entirely in code from material the session already
 * collected — no model call, so it is deterministic, free, and cannot scold.
 * Numbers are allowed here and only here.
 */
export interface SessionRecap {
  /** One plain encouraging line. */
  headline: string;
  /** French the learner produced natively and correctly. */
  wins: string[];
  /** The deferred coaching queue, deduped and capped. */
  fixes: CoachItem[];
  /** Everything introduced this session, register-labelled. */
  phrases: NewPhrase[];
  /** Exactly one thing to work on next. Never a list. */
  nextFocus: string;
  /** What the conversation was actually about, in order: the scene's own topic first, then everywhere the learner steered. */
  topics: { fr: string; en: string }[];
  cefr: { estimate: CefrBand; confidence: 'low' | 'medium' | 'high' };
  stats: { turns: number; rescues: number; unassistedRate: number };
}
