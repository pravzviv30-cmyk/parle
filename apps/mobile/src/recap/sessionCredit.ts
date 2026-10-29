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
  /** Whether the sitting is recorded at all: active day, streak, minutes, XP. */
  settles: boolean;
  /** Whether the end card offers to save the conversation text. */
  savesText: boolean;
  /** The one line under the recap headline. */
  line: string;
}

/**
 * Replies in this scene: the agent's count, plus any carried from the typed
 * part of a scene switched to voice (F903). Null when the agent sent no count.
 */
function sceneReplies(stats: RecapStats, carried: number): number | null {
  const replies = learnerRepliesOf(stats);
  return replies === null ? null : replies + Math.max(0, carried);
}

/**
 * What a finished conversation earns, from its recap stats. Zero replies earns
 * nothing at all (founder, 2026-10-28): no XP, no phrases, no minutes, no
 * streak day, no saved conversation; only the line that time was made.
 */
export function sessionCredit(stats: RecapStats, carriedReplies = 0): SessionCredit {
  const replies = sceneReplies(stats, carriedReplies);
  if (replies === 0) return { earns: false, showPhrases: false, settles: false, savesText: false, line: recapLine(stats) };
  const line = recapLine(replies === null ? stats : { ...stats, learnerReplies: replies });
  return { earns: true, showPhrases: true, settles: true, savesText: true, line };
}

/** Whether any app path may bank practice for this scene. No recap yet, or an older agent: today's path. */
export function banksPracticeFor(stats: RecapStats | null, carriedReplies: number): boolean {
  return stats === null || sceneReplies(stats, carriedReplies) !== 0;
}

/**
 * What the recap effect does with a recap. The end of a scene settles one
 * finished sitting and sends one event. The typed part of a scene switched to
 * voice (F903) settles nothing: the scene settles once, at its real end, with
 * both parts' minutes on the same clock. Whether lines are banked is
 * `banksPracticeFor`, asked by every banking path.
 */
export function recapUse(credit: SessionCredit, use: 'end' | 'switch', settledLocally = false): { settle: boolean; track: boolean } {
  // A Leave whose recap was late already wrote the minutes locally (F905): never twice.
  return { settle: use === 'end' && credit.settles && !settledLocally, track: use === 'end' };
}
