/**
 * Has this learner seen the tutor intro?
 *
 * Per-account, unlike the splash: the splash is a fact about the install, this
 * is a fact about a person. Read inside the Tutor tab rather than at the app
 * root so the bottom nav never flashes and Home is never held up waiting for
 * a disk read that only one tab cares about.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { userKey } from '../storage/scope.ts';

export async function hasSeenTutorIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(userKey('tutorIntro'))) !== null;
  } catch {
    return false;
  }
}

export async function markTutorIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(userKey('tutorIntro'), '1');
  } catch {
    // The learner may see it once more. Nothing is lost.
  }
}
