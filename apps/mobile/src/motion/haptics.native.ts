/** Physical answers for the moments the design system names (STYLE section 11). */
import * as Haptics from 'expo-haptics';

/** A tap that landed: the lightest selection response. */
export function tapSettled(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** Something earned arrived: one success response, never a pattern. */
export function arrived(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A press: a light impact, the weight of a button going down. */
export function pressed(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A hint arriving: the softest impact, so help never feels like a correction. */
export function soft(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}
