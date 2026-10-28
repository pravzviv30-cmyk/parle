/**
 * Speak in a room that started typed (F903, founder decision 2026-10-28).
 *
 * A typed session cannot grow a voice: the mode is signed into its token and
 * its agent built no audio. So Speak asks first, then keeps the typed part
 * (the recap is requested and banked without the end card), releases the
 * lease and rebuilds the session as voice. With no reply there is nothing to
 * keep, and a safety stop never switches.
 */

import { RECAP_COMING_NOTE } from '../tutor/recapWait.ts';

export interface SwitchToVoiceCopy { title: string; body: string; stay: string; confirm: string }

/** The short sheet Speak opens in a typed start, in the tutor's own name. */
export function switchToVoiceCopy(tutorName: string): SwitchToVoiceCopy {
  return {
    title: 'Switch to speaking?',
    body: `${tutorName} starts this scene again with your voice.`,
    stay: 'Stay',
    confirm: 'Switch',
  };
}

/** What the screen shows while the typed part is kept and the voice room is built. */
export const SWITCH_WAIT = { headline: 'Switching to speaking', note: RECAP_COMING_NOTE } as const;

export type SwitchPlan = 'keep-then-rebuild' | 'rebuild' | 'none';

export function switchToVoicePlan(state: { learnerReplies: number; stopped: boolean }): SwitchPlan {
  if (state.stopped) return 'none';
  return state.learnerReplies > 0 ? 'keep-then-rebuild' : 'rebuild';
}

/**
 * A safety stop while the switch is in flight cancels it: no rebuild, no voice
 * session, no microphone. The stop screen is the whole screen.
 */
export function switchAfterStop(state: { switching: 'waiting' | 'rebuilding' | null; stopped: boolean }): 'cancel' | 'carry-on' {
  return state.switching !== null && state.stopped ? 'cancel' : 'carry-on';
}

/**
 * Leave on the switch's wait screen follows the Leave rule (F905), not the
 * switch's. Still waiting for the typed recap: wait for it as a Leave, so it
 * settles as the scene's end. Already rebuilding: that recap was kept as a
 * switch and settled nothing, so the minutes are settled locally on the way out.
 */
export function leaveDuringSwitch(switching: 'waiting' | 'rebuilding'): 'wait-for-recap' | 'settle-locally' {
  return switching === 'waiting' ? 'wait-for-recap' : 'settle-locally';
}
