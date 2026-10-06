/**
 * Whether a screen reader is on, watched live.
 *
 * A takeover's Continue is ready at once for someone using VoiceOver or
 * TalkBack (motion-sound section 4.3): they hear the moment announced and move
 * on when they choose, without waiting out a timeline they cannot see. Null
 * until the OS answers; a failed answer reads as on, the direction that never
 * makes anyone wait.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScreenReader(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (live) setOn(enabled);
      })
      .catch(() => {
        if (live) setOn(true);
      });
    const sub = AccessibilityInfo.addEventListener?.('screenReaderChanged', (enabled: boolean) => {
      if (live) setOn(enabled);
    });
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return on;
}
