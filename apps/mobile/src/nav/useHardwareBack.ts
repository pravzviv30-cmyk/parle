/**
 * Answer the Android hardware back button while a view is up.
 *
 * Several sub-views in this app open in place rather than as a stack route: a
 * Profile option sheet, the phrasebook, the tutor walkthrough, a summary's drill.
 * The stack navigator's own back does not know they exist, so on Android the
 * hardware back either popped the whole screen or did nothing. This hook lets a
 * screen intercept that press for exactly as long as the sub-view is showing.
 *
 * A routed screen registers while focused. Auth and onboarding also open
 * policy pages outside the navigator, where mounting is their visibility
 * boundary. Reading the optional context lets both kinds of page share this
 * hook without requiring a navigator merely to display legal information.
 * `active` gates the listener one level finer: a closed sub-view never consumes
 * the ordinary back action.
 */

import { useContext, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { NavigationContext } from '@react-navigation/native';

/**
 * Route the hardware back button to `onBack` while `active`.
 *
 * Returning `true` from the handler is what tells Android the press was
 * consumed, so it closes the sub-view instead of popping the screen. When
 * `active` is false nothing is registered at all, so the default back stands.
 */
export function useHardwareBack(active: boolean, onBack: () => void): void {
  const navigation = useContext(NavigationContext);
  const latestBack = useRef(onBack);
  latestBack.current = onBack;

  useEffect(() => {
    if (!active || Platform.OS !== 'android') return;
    let subscription: ReturnType<typeof BackHandler.addEventListener> | undefined;
    const remove = () => {
      subscription?.remove();
      subscription = undefined;
    };
    const listen = () => {
      if (subscription !== undefined) return;
      subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        latestBack.current();
        return true;
      });
    };

    if (navigation === undefined || navigation.isFocused()) listen();
    const unsubscribeFocus = navigation?.addListener('focus', listen);
    const unsubscribeBlur = navigation?.addListener('blur', remove);
    return () => {
      remove();
      unsubscribeFocus?.();
      unsubscribeBlur?.();
    };
  }, [active, navigation]);
}
