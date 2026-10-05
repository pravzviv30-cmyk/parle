import AsyncStorage from '@react-native-async-storage/async-storage';
import { holdMic, liveRoom, micLive } from '../sound/audioFocus.ts';
const KEY = '@luvani/interaction-haptics/v1';
let enabled = true;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();
/** A live microphone or an open live room keeps every control still, including Back (F724). */
export const hapticsEnabled = (): boolean => enabled && !micLive() && !liveRoom();
/** A live microphone suppresses feedback from every control. The microphone focus hold, by its older name. */
export const silenceRecordingHaptics: () => () => void = holdMic;
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
