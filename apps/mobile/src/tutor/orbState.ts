/**
 * What the Tutor tab's circle says, decided from the facts (F542).
 *
 * The circle was violet whatever the account held, so a learner with no
 * speaking time was invited to tap and refused after a probe. Four facts decide
 * it now, in this order: a probe in flight, because it is the most current
 * thing known; the servers being away, because without them nothing below
 * matters; the account being unable to start, which is core's answer carried
 * through `/billing/status`; and only then ready.
 *
 * `canStart` is `null` when nobody could ask, and null reads as ready on
 * purpose: the server refuses a start it cannot afford, and a circle that went
 * quiet because a status read failed would refuse a learner the server would
 * have let in. The one thing this never does is invent a reason: the caption
 * for a spent account says there is no speaking time, not why.
 *
 * Here rather than in the tab because a `.tsx` in this workspace is a file no
 * test can ask a question of. `gate.ts` already holds the words for a server
 * that is away, and they are reused rather than restated.
 */

import { TUTOR_OFFLINE } from './gate.ts';
import { TUTOR_ORB_SUBLINE } from './dashboard.ts';
import type { OrbState } from './VoiceOrb.tsx';

export interface TutorOrbFacts {
  /** The token server answered its health probe. */
  live: boolean;
  /** A probe is in flight right now. */
  checking: boolean;
  /** Core's answer to "may a session start", or null when nobody could ask. */
  canStart: boolean | null;
}

export interface TutorOrbView {
  state: OrbState;
  /** The line under the circle. The card says the words, so the orb says none. */
  title: string;
  subline: string;
}

export const ORB_AWAY = 'Your tutor is away right now';
export const ORB_AWAY_SUB = 'Practice and review still work.';
export const ORB_SPENT = 'No speaking time just now';
export const ORB_SPENT_SUB = 'Practice and review stay open.';
export const ORB_READY = 'Tap to speak';

/** Every line this module can say, for the copy sweeps. */
export const ORB_COPY: readonly string[] = [ORB_AWAY, ORB_AWAY_SUB, ORB_SPENT, ORB_SPENT_SUB, ORB_READY];

export function tutorOrbState(facts: TutorOrbFacts): TutorOrbView {
  if (facts.checking) return { state: 'thinking', title: TUTOR_OFFLINE.checking, subline: TUTOR_ORB_SUBLINE };
  if (!facts.live) return { state: 'error', title: ORB_AWAY, subline: ORB_AWAY_SUB };
  if (facts.canStart === false) return { state: 'idle', title: ORB_SPENT, subline: ORB_SPENT_SUB };
  return { state: 'ready', title: ORB_READY, subline: TUTOR_ORB_SUBLINE };
}
