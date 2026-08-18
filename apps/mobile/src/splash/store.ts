/**
 * Has this install seen the welcome yet?
 *
 * Device-level, not per-account, and deliberately so: the splash runs BEFORE
 * the sign-in gate, and `userKey()` throws when nobody is signed in. Same
 * shape as the legacy-migration marker next door, for the same reason.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEN_SPLASH = 'parle.seenSplash.v1';

export async function hasSeenSplash(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_SPLASH)) !== null;
  } catch {
    // Storage unavailable: show it. A second welcome is a smaller failure than
    // a first launch that skips the only explanation of what this app is.
    return false;
  }
}

export async function markSplashSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_SPLASH, '1');
  } catch {
    // The learner still gets through; they may see it once more.
  }
}
