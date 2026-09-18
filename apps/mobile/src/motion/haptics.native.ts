/** Physical answers for the two moments the design system names. */
import * as Haptics from 'expo-haptics';

/** A tap that landed: the lightest selection response. */
export function tapSettled(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** Something earned arrived: one success response, never a pattern. */
export function arrived(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
