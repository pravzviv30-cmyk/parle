import type { CorrectionReasonId } from '@luvani/core';
/**
 * The conversation, as a list.
 *
 * The wire has no such thing. `ConvoView` is a snapshot of ONE turn and the
 * hook replaces it wholesale on every message, so a running transcript has to
 * be accumulated on this side out of messages that already exist. That is a
 * deliberate choice over adding a wire tag carrying history: a new tag means
 * touching the shared protocol, both agents and the core protocol tests, to buy
 * a benefit — surviving a reconnect — that the app has no reconnect flow to
 * use.
 *
 * Kept pure and separate from the hook so the shape of the transcript is
 * readable without reading the whole live session.
 */

export interface TurnLine {
  id: string;
  /** The narrator is its own kind: it sets the scene and is not a character. */
  who: 'tutor' | 'learner' | 'narration';
  fr: string;
  /** How the line is spelled when that differs from how it is said. */
  frWritten: string | null;
  en: string | null;
  /**
   * A correction attached to the learner line it corrects, so a recast is read
   * where the mistake was made rather than floating free at the bottom.
   */
  recasts?: { quote: string; better: string; betterEn: string; why: string; textTurnId?: string; correctionIndex?: number; reason?: CorrectionReasonId }[];
}

/** Long enough that nobody scrolls to the top of a five-minute conversation. */
export const MAX_TURNS = 40;

/**
 * Append, unless it is the line already at the end.
 *
 * The dedupe is load-bearing rather than defensive. The hook re-sends `ready`
 * while it waits for the agent, and both agents answer `ready` by republishing
 * their current view — so without this, every retry would push a second copy of
 * whatever the tutor last said.
 */
export function pushTurn(list: readonly TurnLine[], line: Omit<TurnLine, 'id'>, id: string): TurnLine[] {
  const last = list[list.length - 1];
  if (last && last.who === line.who && last.fr === line.fr) {
    // Same line again, but a republish can carry recasts the first copy lacked.
    if (!line.recasts?.length || last.recasts?.length) return list as TurnLine[];
    const merged = [...list];
    merged[merged.length - 1] = { ...last, recasts: line.recasts };
    return merged;
  }
  const next = [...list, { ...line, id }];
  return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
}
