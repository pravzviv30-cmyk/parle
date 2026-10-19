import type { TutorVoiceKey } from '@luvani/core';
import type { DailyItem } from '../daily/catalogue.ts';
import type { TutorAudioPack } from '../daily/tutorAudio.ts';
import { shadowingPhrase } from '../daily/shadowing.ts';
/** Use real recordings in the chosen voice, pitched like the Explore shelf. */
export function offlinePractice(items: readonly DailyItem[], audio: TutorAudioPack, voice: TutorVoiceKey, tier: 1 | 2 | 3) {
  return shadowingPhrase(items.filter(item => item.tier === tier), audio, voice) ?? shadowingPhrase(items, audio, voice);
}
