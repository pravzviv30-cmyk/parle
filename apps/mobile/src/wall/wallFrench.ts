import type { Momentum } from '../progress/momentum.ts';

/**
 * Page two: the learner's own French, and that it is adding up.
 *
 * This is an adapter and not a second fold. `progress/momentum.ts` already
 * decides every count, every label and every unit in this app, and Home draws
 * the same numbers from it; a wall that counted for itself would be the second
 * answer to a question that has one owner, and the two would disagree the first
 * time either changed. So nothing here counts anything. It reads what momentum
 * decided and answers the one question momentum has no opinion about: whether
 * this page has real evidence to show, or is still an invitation.
 *
 * The page is drawn either way. The wall varies its tail, never its opening or
 * its middle: a learner at the very start is told what will collect here, which
 * is true, and is a better sentence than a nought.
 */
export interface WallFrench {
  /** Phrases with at least one real conversational use, or null when there are none. */
  count: number | null;
  /** '+6 this week', or null when nothing arrived this week. */
  weekLine: string | null;
  /** The learner's own French, most used first. Empty when there is none. */
  chips: readonly string[];
  /** '+4 more', or null. */
  moreLine: string | null;
  /** Seven marks, index six being today. */
  week: readonly boolean[];
  /** Distinct local days with something on them, or null. */
  days: number | null;
  /**
   * Whether there is real evidence on this page.
   *
   * False is not an error and not an empty state: it is the start line, and the
   * page says what will arrive rather than that nothing has.
   */
  hasEvidence: boolean;
}

export function wallFrench(momentum: Momentum): WallFrench {
  const { retained, days } = momentum;
  return {
    count: retained.count,
    weekLine: retained.weekLine,
    chips: retained.chips,
    moreLine: retained.moreLine,
    week: days.week,
    days: days.count,
    // One question, asked of the thing that owns the answer. A learner with a
    // count has said something in a room; a learner without one has not, and no
    // arrangement of the other fields changes which of those is true.
    hasEvidence: retained.count !== null,
  };
}
