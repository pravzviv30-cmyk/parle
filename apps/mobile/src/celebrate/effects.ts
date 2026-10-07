/**
 * Where a celebration's beats meet the device: the twelve sounds through the
 * one sound seam (`sound/sfx.ts`) and the haptics through `motion/haptics.ts`.
 *
 * Nothing else in `celebrate/` plays a sound or a haptic. Each beat asks the
 * audio focus at the moment it fires (`timelines.ts` beatEffects), so a
 * microphone or a live room that opens mid-moment silences the rest; the sound
 * gate and the haptic switch ask again underneath (D8). The platform files
 * stand behind both seams, so under Node this module plays nothing.
 */

import { arrived, cancelHaptics, celebrate, thump, tick } from '../motion/haptics.ts';
import { liveRoom, micLive } from '../sound/audioFocus.ts';
import { pauseAllSfx, play } from '../sound/sfx.ts';
import { beatEffects, stillEffects, type Beat, type Effects, type FocusNow, type HapticCue, type Timeline } from './timelines.ts';

const HAPTIC: Readonly<Record<HapticCue, () => void>> = { tick, thump, arrived, celebrate };

/** Who holds the learner's ears this instant. */
export function focusNow(): FocusNow {
  return { micLive: micLive(), liveRoom: liveRoom() };
}

function fire(effects: Effects): void {
  if (effects.sound !== null) play(effects.sound);
  if (effects.haptic !== null) HAPTIC[effects.haptic]();
}

/** One beat's sound and haptic, unless a microphone or a live room is open. */
export function fireBeat(beat: Beat): void {
  fire(beatEffects(beat, focusNow()));
}

/** A card shown still: its one sound and haptic, once, unless a microphone or a live room is open. */
export function fireStill(timeline: Timeline): void {
  fire(stillEffects(timeline, focusNow()));
}

/** A skip, a hold or a safety stop: haptic beats still waiting are dropped and every sound effect stops. */
export function stopEffects(): void {
  cancelHaptics();
  pauseAllSfx();
}

/** The count-tick sound, for a CountUp that ticks by sound. */
export function countTick(): void {
  const focus = focusNow();
  if (focus.micLive || focus.liveRoom) return;
  play('count-tick');
}
