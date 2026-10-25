/**
 * Slower voice (2026-10-25): a device-local choice about how fast the tutor's
 * voice speaks. Unlike Quiet voice it does reach the tutor: the session start
 * body carries `voiceSpeed` when the learner has chosen, and leaves it out when
 * they have not, so the tutor's own default decides (lessons and A0 to A1
 * learners get the slower voice).
 *
 * The shape of quietVoicePreference.ts: only the literal stored 'slower' or
 * 'normal' reads as a choice, anything else is "not chosen", a load that loses
 * the race to a set never overwrites it, writes run in order and a failed one
 * rolls back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VoiceSpeed = 'slower' | 'normal';
/** Null is "not chosen": the tutor's default applies. */
export type VoiceSpeedChoice = VoiceSpeed | null;

export const VOICE_SPEED_KEY = '@luvani/voice-speed/v1';
let choice: VoiceSpeedChoice = null;
let revision = 0;
let writes: Promise<unknown> = Promise.resolve();

export const voiceSpeedChoice = (): VoiceSpeedChoice => choice;

const parse = (value: string | null): VoiceSpeedChoice => (value === 'slower' || value === 'normal' ? value : null);

export async function loadVoiceSpeedPreference(): Promise<VoiceSpeedChoice> {
  const owner = revision;
  try {
    const value = await AsyncStorage.getItem(VOICE_SPEED_KEY);
    if (owner === revision) choice = parse(value);
  } catch {
    /* A device preference is best effort. */
  }
  return choice;
}

export async function setVoiceSpeedPreference(value: VoiceSpeed): Promise<boolean> {
  const owner = ++revision;
  const previous = choice;
  choice = value;
  const work = writes.then(() => AsyncStorage.setItem(VOICE_SPEED_KEY, value));
  writes = work.catch(() => {});
  try {
    await work;
    return true;
  } catch {
    if (owner === revision) choice = previous;
    return false;
  }
}
