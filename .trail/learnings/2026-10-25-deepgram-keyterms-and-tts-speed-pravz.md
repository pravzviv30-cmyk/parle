---
title: Deepgram keyterms and TTS speed under the paid proxy
author: Pravz
date: 2026-10-25
branch: claude/slower-voice-keyterms
touches:
  - services/tutor-agent/src/paidVoiceProxy.ts
  - services/shared/paidExecution.ts
  - services/tutor-agent/src/agent.ts
  - services/tutor-agent/src/voice.ts
  - services/tutor-agent/src/voiceConfiguration.ts
  - packages/core/src/lessons/keyterms.ts
---

## Decided
- Scripted lessons and guest scenes give Deepgram ONE fixed keyterm list (`lessonKeyterms`) at STT construction, never per turn (VOICE-017).
- Keyterm values and TTS `speed` are input, not quote configuration: the STT descriptor carries `keyterm: 'prompted'` instead of values, and `speed` 0.7-1.2 is stripped from the TTS identity (VOICE-016). Existing quotes keep matching.
- The proxy falls back to the plain stream on `quote-mismatch` (thrown before any claim), so keyterms switch on only once the bound quote has the keyterm STT component.

## Tried and ruled out
- Per-turn keyterms under the paid proxy: every keyterm change makes the LiveKit Deepgram plugin reopen the socket, and each socket is admitted as a full session of audio, so a quote runs out within a few turns.
- A quote component per TTS speed: six voices (plus Flash) already press the sixteen-component quote limit.
- Speed 0.9: only about 5% slower than 1.0 on multilingual v2; 0.85 is about 17% slower (measured).
- A synthetic accent (an English ElevenLabs voice reading French) sounds near-native, so it cannot show a keyterm gain; real beginner recordings are needed.

## Watch out
- `recognitionPhrases` drops any line containing `?` and caps at 12 input lines and 16 phrases; feed full targets first or the last turns vanish.
- The proxy must forward the re-encoded query it hashed (`?${url.searchParams}`), never the raw `url.search`.
- ElevenLabs premade voice ids move: `21m00Tcm4TlvDq8ikWAM` is no longer "Rachel".
- DECISIONS IDs collide across parallel branches; check the other `claude/*` branches before taking the next VOICE- number.
