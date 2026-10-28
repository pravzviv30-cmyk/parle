/**
 * Whether a conversation earned credit (F904, founder decision 2026-10-28:
 * "turns earn credit").
 *
 * `stats.turns` counts every brain turn, silence rescues included, so a scene
 * the learner never spoke in could still read as a conversation and bank XP
 * and "new phrases". The agent now also sends `learnerReplies`, the typed or
 * spoken replies alone. Zero of those earns no XP, no phrases tile and no
 * claim of a conversation. An older agent that sends no count keeps today's
 * behaviour, because absence is not evidence of silence.
 */

import { recapLine, type RecapStats } from '../tutor/recapLine.ts';

/** The learner's own reply count, or null when the agent did not send a usable one. */
export function learnerRepliesOf(stats: RecapStats): number | null {
  const n = stats.learnerReplies;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export interface SessionCredit {
  /** Whether this sitting earns content XP. The price stays `conversationXp` in ConvoScreen. */
  earns: boolean;
  /** Whether the end card may count new phrases. */
  showPhrases: boolean;
  /** The one line under the recap headline. */
  line: string;
}

/** What a finished conversation earns, from its recap stats. */
export function sessionCredit(stats: RecapStats): SessionCredit {
  const line = recapLine(stats);
  if (learnerRepliesOf(stats) === 0) return { earns: false, showPhrases: false, line };
  return { earns: true, showPhrases: true, line };
}
