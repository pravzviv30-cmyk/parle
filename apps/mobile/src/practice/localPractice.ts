import type { TutorVoiceKey } from '@luvani/core';
import type { DailyItem } from '../daily/catalogue.ts';
import { dailyTutorVoice, tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';

/** The same authored café line on every surface, in the selected tutor's voice. */
export function localPracticeFor(voice: unknown, items: readonly DailyItem[], audio: TutorAudioPack) {
  const key = dailyTutorVoice(voice as TutorVoiceKey);
  return items.find(item => item.id === DEMO_REPLY_ID && tutorAudioFor(audio, item.id, key) != null) ?? null;
}
