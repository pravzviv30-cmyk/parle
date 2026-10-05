/**
 * The learner's sound-effects switch, kept on this device only, like the haptics one
 * (motion/hapticPreference.ts). On by default (decision D8); the sound itself still follows the
 * phone's silent switch (sound/audioModes.ts SFX_MODE).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = '@luvani/interaction-sound/v1';
let enabled = true;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();
export const soundEnabled = (): boolean => enabled;
export async function loadSoundPreference(): Promise<boolean> {
  const owner = revision;
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (owner === revision) enabled = value !== 'off';
  } catch {
    /* A device preference is best effort. */
  }
  return enabled;
}
export async function setSoundPreference(value: boolean): Promise<boolean> {
  const owner = ++revision;
  const previous = enabled;
  enabled = value;
  const work = writes.then(() => AsyncStorage.setItem(KEY, value ? 'on' : 'off'));
  writes = work.catch(() => {});
  try {
    await work;
    return true;
  } catch {
    if (owner === revision) enabled = previous;
    return false;
  }
}
