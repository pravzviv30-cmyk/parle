import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY = '@luvani/interaction-haptics/v1';
let enabled = true;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();
let microphoneMutes = 0;
export const hapticsEnabled = (): boolean => enabled && microphoneMutes === 0;
/** A live microphone suppresses feedback from every control, including Back. */
export function silenceRecordingHaptics(): () => void {
  microphoneMutes++;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      microphoneMutes--;
    }
  };
}
export async function loadHapticPreference(): Promise<boolean> {
  const owner = revision;
  try {
    const value = await AsyncStorage.getItem(KEY);
    if (owner === revision) enabled = value !== 'off';
  } catch {
    /* A device preference is best effort. */
  }
  return enabled;
}
export async function setHapticPreference(value: boolean): Promise<boolean> {
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
