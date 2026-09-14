/**
 * Answer the Android hardware back button while a view is up.
 *
 * Several sub-views in this app open in place rather than as a stack route: a
 * Profile option sheet, the phrasebook, the tutor walkthrough, a summary's drill.
 * The stack navigator's own back does not know they exist, so on Android the
 * hardware back either popped the whole screen or did nothing. This hook lets a
 * screen intercept that press for exactly as long as the sub-view is showing.
 *
 * `useFocusEffect` is what scopes it. The listener is registered when the screen
 * gains focus and torn down when it loses focus, so a view that is not on top of
 * the stack never eats the press meant for whatever is. And `active` gates it
 * one level finer: the same screen registers nothing while its sub-view is
 * closed, so ordinary back still works, and only steps in when there is
 * something in place to close.
 */

import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Route the hardware back button to `onBack` while `active`.
 *
 * Returning `true` from the handler is what tells Android the press was
 * consumed, so it closes the sub-view instead of popping the screen. When
 * `active` is false nothing is registered at all, so the default back stands.
 */
export function useHardwareBack(active: boolean, onBack: () => void): void {
  useFocusEffect(
    useCallback(() => {
      // React Native Web exposes the BackHandler shape but deliberately does
      // not implement subscriptions. The wall is previewable on web, so the
      // hook must be a genuine no-op there rather than logging an exception on
      // every render.
      if (!active) return;
      if (Platform.OS === 'web') return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [active, onBack]),
  );
}
