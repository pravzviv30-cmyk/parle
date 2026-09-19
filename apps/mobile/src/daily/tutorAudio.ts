import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey, type TutorVoiceKey } from '@luvani/core';

export type TutorAudioPack = Readonly<Partial<Record<TutorVoiceKey, Readonly<Record<string, number>>>>>;
/** Match the live tutor default only when no valid choice is stored. Never use
 * another voice or the legacy generic pack to fill missing recordings. */
export function dailyTutorVoice(value: unknown): TutorVoiceKey {
  return isTutorVoiceKey(value) ? value : DEFAULT_TUTOR_VOICE;
}
export function tutorAudioFor(pack: TutorAudioPack, id: string, voice: TutorVoiceKey): number | undefined {
  const recordings = pack[voice];
  return recordings && Object.hasOwn(recordings, id) ? recordings[id] : undefined;
}
