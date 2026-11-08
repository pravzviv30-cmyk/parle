---
title: Tutor STT language and paid quotes are coupled
author: Pravz
date: 2026-11-06
branch: claude/tutor-hear-stay-8c1081
cost: { minutes: 6, tokens: 161814 }
touches:
  - packages/brain/src/prompt/prompt.test.ts
  - scripts/measureKeyterms.mjs
  - services/tutor-agent/src/paidVoiceProxy.ts
  - scripts/paidQuotes.mjs
---

## Decided
- Lane C (2026-11-06): every session kind moves to Deepgram nova-3 `language: 'multi'` with `endpointing: 100`, keeping the lesson/guest-scene keyterms, so English answers reach the brain as English. Measure fr vs multi first (scripts/measureKeyterms.mjs).

## Tried and ruled out
- `language_hint` fr/en on nova-3: the LiveKit Deepgram plugin 1.9.0 only passes `languageHint` for Flux (`STTv2`, flux-general-multi). nova-3 multi has no hint parameter.

## Watch out
- On staging (NODE_ENV=production, not a guest scene) every Deepgram stream goes through the paid voice proxy, which hashes `language`, `endpointing` and the other URL params into the quote identity (services/tutor-agent/src/paidVoiceProxy.ts describeStreamingDeepgram). Any STT option change needs `scripts/paidQuotes.mjs` regenerated, the SQL applied on staging and LUVANI_PAID_QUOTE_BINDINGS restaged on api, tutor and practice together, with the founder's OK.
- Each quoted STT component is ONE stream (maxEffects 1): an STT `maxRetry` or a mid-session language switch opens another stream and needs another component, or the gate refuses it. The guest scene gate allows 2 sockets (guestSceneGate.ts GUEST_SCENE_STT_SOCKETS).
- `setSttLanguage` restarts the stream even when the language is unchanged; guard it.
