/**
 * One place that decides what the tutor sounds like.
 *
 * The agent and the warm-cache script both build their TTS here, so the cache key
 * (vendor, voice, model) can never drift between them. Drift would mean the warm
 * script fills a cache the agent never reads.
 */

import { fileURLToPath } from 'node:url';
import { tts } from '@livekit/agents';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import { CachedTTS } from './ttsCache.ts';

/** Lives inside the service so a repo clone starts cold, not with stale audio. */
export const DEFAULT_CACHE_DIR = fileURLToPath(new URL('../.tts-cache', import.meta.url));

export function buildTTS(): CachedTTS {
  const voiceId = process.env.ELEVEN_VOICE_ID;
  const inner = new elevenlabs.TTS({ languageCode: 'fr', ...(voiceId ? { voiceId } : {}) });

  return new CachedTTS(inner, {
    dir: process.env.TTS_CACHE_DIR ?? DEFAULT_CACHE_DIR,
    voiceKey: `elevenlabs:${voiceId ?? 'default'}:${inner.model}`,
  });
}
