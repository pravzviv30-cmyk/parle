import type { DailyItem } from './catalogue.ts';
import type { TutorVoiceKey } from '@luvani/core';
import { tutorAudioFor, type TutorAudioPack } from './tutorAudio.ts';
export function shadowingPhrase(items:readonly DailyItem[], audio:TutorAudioPack, voice:TutorVoiceKey): DailyItem | null {
  return items.find(item => item.label === 'Phrase' && tutorAudioFor(audio,item.id,voice) != null) ?? null;
}
