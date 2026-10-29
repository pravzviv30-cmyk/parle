import type { TutorVoiceKey } from '@luvani/core';
import type { DailyItem } from '../daily/catalogue.ts';
import { dailyTutorVoice, tutorAudioFor, type TutorAudioPack } from '../daily/tutorAudio.ts';
import { DEMO_REPLY_ID } from '../onboarding/tutorLines.ts';

/** The same authored café line on every surface, in the selected tutor's voice. */
export function localPracticeFor(voice: unknown, items: readonly DailyItem[], audio: TutorAudioPack) {
  const key = dailyTutorVoice(voice as TutorVoiceKey);
  return items.find(item => item.id === DEMO_REPLY_ID && tutorAudioFor(audio, item.id, key) != null) ?? null;
}

/** Said above the offline lead (F924), so a swapped card is never silent. */
export const OFFLINE_NOTICE = "You're offline. Here's something you can do without a connection.";

/**
 * What the offline lead offers. The café line is a Starter line, so a learner
 * past Starter is pointed at what below already works offline (today's phrase,
 * review) instead of being handed a first order as their next step.
 */
export function offlineOffer(levelIndex: number): 'cafe' | 'below' {
  return levelIndex > 0 ? 'below' : 'cafe';
}

/** Said when the device is online but the tutor's server does not answer. */
export const TUTOR_UNREACHABLE = "We can't reach your tutor right now. Here's something you can do while we try again.";

/** "Offline" only when the platform says so; a failed /health alone is the tutor out of reach. */
export function offlineNotice(onLine: boolean | undefined): string {
  return onLine === false ? OFFLINE_NOTICE : TUTOR_UNREACHABLE;
}

/** The platform's own answer: `navigator.onLine` on web; undefined where there is none (no new dependency). */
export function deviceOnLine(): boolean | undefined {
  const nav = (globalThis as { navigator?: { onLine?: unknown } }).navigator;
  return typeof nav?.onLine === 'boolean' ? nav.onLine : undefined;
}
