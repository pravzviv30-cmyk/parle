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

/** Text matching keeps accents, case and punctuation. A topic/search key is
 * too broad to prove that a recording says the displayed French. */
export function tutorAudioForFrench(
  pack: TutorAudioPack,
  items: readonly { id: string; fr: string }[],
  french: string,
  voice: TutorVoiceKey,
): number | undefined {
  const text = french.normalize('NFC').trim();
  if (!text) return undefined;
  for (const item of items) {
    if (item.fr.normalize('NFC').trim() !== text) continue;
    const asset = tutorAudioFor(pack, item.id, voice);
    if (asset !== undefined) return asset;
  }
  return undefined;
}
