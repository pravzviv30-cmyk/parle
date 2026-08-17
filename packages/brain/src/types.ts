/**
 * Shared vocabulary for the brain.
 *
 * Core's `CefrLevel` stays lesson-scoped (A0–A2) on purpose: scripted lessons are
 * a beginner product. The brain serves everyone from a first bonjour to argot with
 * friends, so it carries the full band and never widens core's type.
 */

export type CefrBand = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

/** Ordered, so distance between two bands is index arithmetic. */
export const CEFR_BANDS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const satisfies readonly CefrBand[];

/**
 * How eagerly the coach interrupts the scene.
 *
 * This dial moves *when* feedback lands (inline vs the end recap), never *whether*
 * it lands. Textbook-but-unnatural phrasing surfaces inline at every setting —
 * that behaviour is the product and is pinned by tests, not by this type.
 */
export type Strictness = 'flow' | 'balanced' | 'strict';

/**
 * French registers, from street to formal. Every phrase the brain teaches carries
 * one of these, because knowing *who you can say it to* is the skill — a word
 * without its register is a trap, not vocabulary.
 */
export type RegisterId = 'argot' | 'familier' | 'courant' | 'soutenu';

export interface BrainConfig {
  strictness: Strictness;
  /** Turn budget after which the session wraps into a recap. */
  maxTurns: number;
}

export const DEFAULT_CONFIG: BrainConfig = { strictness: 'balanced', maxTurns: 24 };
