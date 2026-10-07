/** Physical answers for the moments the design system names (STYLE section 11, come alive section 7). */
import * as Haptics from 'expo-haptics';
import { hapticsEnabled } from './hapticPreference.ts';
import { CELEBRATE_BEATS, TICK_GAP_MS, createBeats, createThrottle } from './hapticBeats.ts';

/** A tap that landed: the lightest selection response. */
export function tapSettled(): void {
  if (!hapticsEnabled()) return;
  void Haptics.selectionAsync().catch(() => {});
}

/** Something earned arrived: one success response. The one pattern is `celebrate`. */
export function arrived(): void {
  if (!hapticsEnabled()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A press: a light impact, the weight of a button going down. */
export function pressed(): void {
  if (!hapticsEnabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A hint arriving: the softest impact, so help never feels like a correction. */
export function soft(): void {
  if (!hapticsEnabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}

const tickGate = createThrottle(TICK_GAP_MS);

/** A step in a count: a selection tick, never closer than 60 ms to the last one. */
export function tick(): void {
  if (!hapticsEnabled() || !tickGate()) return;
  void Haptics.selectionAsync().catch(() => {});
}

/** A weight landing, a flame lighting: one medium impact. */
export function thump(): void {
  if (!hapticsEnabled()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

const beats = createBeats(hapticsEnabled);

/**
 * A real win: success, then medium at 140 ms, then light at 280 ms. Every beat
 * asks the haptic switch again as it fires, so a microphone opening mid-pattern
 * silences the rest, and `cancelHaptics` drops whatever has not fired.
 */
export function celebrate(): void {
  beats.play(CELEBRATE_BEATS, (beat) => {
    if (beat === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (beat === 'medium') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  });
}

/** Drop any celebration beats still waiting: a skip, a safety stop, the app leaving the screen. */
export function cancelHaptics(): void {
  beats.cancel();
}
