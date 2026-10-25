/**
 * Tap to send (2026-10-25): a device-local choice to end a spoken turn with a
 * tap rather than a pause. The microphone stays open as it always does; pauses
 * never end the turn, only Send or the sixty second cap. The app tells the
 * agent (heldTurn.ts says when), whose own default is off.
 *
 * The shape of quietVoicePreference.ts: off by default, only the literal
 * stored 'on' reads as on, a load that loses the race to a set never overwrites
 * it, writes run in order and a failed one rolls back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TAP_TO_SEND_KEY = '@luvani/tap-to-send/v1';
let enabled = false;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();

export const tapToSendOn = (): boolean => enabled;

export async function loadTapToSendPreference(): Promise<boolean> {
  const owner = revision;
  try {
    const value = await AsyncStorage.getItem(TAP_TO_SEND_KEY);
    if (owner === revision) enabled = value === 'on';
  } catch {
    /* A device preference is best effort. */
  }
  return enabled;
}

export async function setTapToSendPreference(value: boolean): Promise<boolean> {
  const owner = ++revision;
  const previous = enabled;
  enabled = value;
  const work = writes.then(() => AsyncStorage.setItem(TAP_TO_SEND_KEY, value ? 'on' : 'off'));
  writes = work.catch(() => {});
  try {
    await work;
    return true;
  } catch {
    if (owner === revision) enabled = previous;
    return false;
  }
}
