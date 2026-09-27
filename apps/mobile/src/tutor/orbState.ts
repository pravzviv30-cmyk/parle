/**
 * What the Tutor tab's circle says, decided from the facts (F542).
 *
 * The circle was violet whatever the account held, so a learner with no
 * speaking time was invited to tap and refused after a probe. Four facts decide
 * it now, in this order: a probe in flight becomes the responsive Connecting
 * state; the servers being away; the account being unable to start, which is
 * core's answer carried through `/billing/status`; and only then ready.
 *
 * `canStart` is `null` when nobody could ask, and null reads as ready on
 * purpose: the server refuses a start it cannot afford, and a circle that went
 * quiet because a status read failed would refuse a learner the server would
 * have let in. The one thing this never does is invent a reason: the caption
 * for a spent account says there is no speaking time, not why.
 *
 * Here rather than in the tab because a `.tsx` in this workspace is a file no
 * test can ask a question of. The title is deliberately short enough to sit
 * inside the orb; the longer explanation stays underneath it.
 */

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

export const ORB_AWAY = 'Unavailable';
export const ORB_AWAY_SUB = 'Your tutor is away right now. Practice and review still work.';
export const ORB_SPENT = 'Speaking paused';
export const ORB_SPENT_SUB = 'No speaking time just now. Practice and review stay open.';
export const ORB_CONNECTING = 'Connecting';
export const ORB_CONNECTING_SUB = 'Opening your room.';
export const ORB_READY = 'Tap to talk';

/**
 * The line under the pill. Speak and Type are a mode, not a price: both open
 * the live tutor, so both say they use live minutes. Free, quiet practice is
 * Practice's to offer, and it says so there. Declared before ORB_COPY, which
 * reads it at load.
 */
export const LAUNCH_NOTICE = {
  speak: 'Take your time. Ask for a hint whenever you need one. Uses live minutes.',
  type: 'A quiet conversation with no microphone or tutor audio. Uses live minutes.',
} as const;

/** Every line this module can say, for the copy sweeps. */
export const ORB_COPY: readonly string[] = [
  ORB_AWAY,
  ORB_AWAY_SUB,
  ORB_SPENT,
  ORB_SPENT_SUB,
  ORB_CONNECTING,
  ORB_CONNECTING_SUB,
  ORB_READY,
  LAUNCH_NOTICE.speak,
  LAUNCH_NOTICE.type,
];

/**
 * What the one start button says, so its words match what a tap will do.
 *
 * When the tutor is unreachable a tap re-checks the connection and only then
 * opens a room, so the button says that instead of promising a conversation
 * it cannot start. Typed is a mode, not a price: both modes use the live tutor.
 */
export const LAUNCH_RETRY = 'Check connection';
export function launchLabel(facts: { checking: boolean; live: boolean; mode: 'speak' | 'type' }): string {
  if (facts.checking) return 'Connecting…';
  if (!facts.live) return LAUNCH_RETRY;
  return facts.mode === 'type' ? 'Start typing' : 'Start speaking';
}

/**
 * What a screen reader hears for the pill, the one launch on the tab (Stage 3A).
 *
 * The circle used to carry this name as a second start control. It moved here
 * with the press: the same words, on the one thing that starts a conversation.
 * An unreachable tutor is offered the connection check, never a conversation.
 */
export function launchAccessibilityLabel(facts: { checking: boolean; live: boolean; mode: 'speak' | 'type'; tutorName: string }): string {
  if (facts.checking || !facts.live) return launchLabel(facts);
  return `Start ${facts.mode === 'type' ? 'a typed' : 'a spoken'} conversation with ${facts.tutorName}`;
}

export function launchNotice(mode: 'speak' | 'type'): string {
  return LAUNCH_NOTICE[mode];
}

/**
 * What a screen reader hears for the circle, which is a state indicator now and
 * not a control (Stage 3A). A state, named for the tutor, and never an action:
 * nothing happens when the circle is pressed, so it must not say "tap".
 */
export function orbStatusLabel(view: TutorOrbView, tutorName: string): string {
  switch (view.state) {
    case 'connecting':
      return `${tutorName} is connecting`;
    case 'error':
      return `${tutorName} is away right now`;
    case 'idle':
      return `${tutorName} has no speaking time just now`;
    default:
      return `${tutorName} is ready when you are`;
  }
}

export function tutorOrbState(facts: TutorOrbFacts): TutorOrbView {
  if (facts.checking) return { state: 'connecting', title: ORB_CONNECTING, subline: ORB_CONNECTING_SUB };
  if (!facts.live) return { state: 'error', title: ORB_AWAY, subline: ORB_AWAY_SUB };
  if (facts.canStart === false) return { state: 'idle', title: ORB_SPENT, subline: ORB_SPENT_SUB };
  return { state: 'ready', title: ORB_READY, subline: TUTOR_ORB_SUBLINE };
}
