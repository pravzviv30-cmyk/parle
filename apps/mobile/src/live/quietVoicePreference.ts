/**
 * Quiet voice (2026-10-23): a device-local choice to speak softly, close to the
 * phone, in public. Client only, like Listen only: nothing new goes to the tutor.
 * A soft voice (about -36 dBFS) is heard at today's defaults; a whisper is not,
 * because the speech plugin drops frames under RMS 0.004. So the room opens the
 * transcript, says what carries, and lowers the mic meter's floor (levels.ts).
 *
 * The shape of motion/hapticPreference.ts: off by default, only the literal
 * stored 'on' reads as on, a load that loses the race to a set never overwrites
 * it, writes run in order and a failed one rolls back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUIET_VOICE_KEY = '@luvani/quiet-voice/v1';
let enabled = false;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();

export const quietVoiceOn = (): boolean => enabled;

export async function loadQuietVoicePreference(): Promise<boolean> {
  const owner = revision;
  try {
    const value = await AsyncStorage.getItem(QUIET_VOICE_KEY);
    if (owner === revision) enabled = value === 'on';
  } catch {
    /* A device preference is best effort. */
  }
  return enabled;
}

export async function setQuietVoicePreference(value: boolean): Promise<boolean> {
  const owner = ++revision;
  const previous = enabled;
  enabled = value;
  const work = writes.then(() => AsyncStorage.setItem(QUIET_VOICE_KEY, value ? 'on' : 'off'));
  writes = work.catch(() => {});
  try {
    await work;
    return true;
  } catch {
    if (owner === revision) enabled = previous;
    return false;
  }
}
