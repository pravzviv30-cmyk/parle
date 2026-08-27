# Voice TTS Settings

> 16 nodes · cohesion 0.17

## Key Concepts

- **voice.ts** (17 connections) — `services/tutor-agent/src/voice.ts`
- **warmCache.ts** (12 connections) — `services/tutor-agent/src/warmCache.ts`
- **LESSONS** (7 connections) — `packages/core/src/lessons/index.ts`
- **buildTTS()** (5 connections) — `services/tutor-agent/src/voice.ts`
- **voice.test.ts** (5 connections) — `services/tutor-agent/src/voice.test.ts`
- **CONVO_LINES** (3 connections) — `services/tutor-agent/src/convo.ts`
- **main()** (3 connections) — `services/tutor-agent/src/warmCache.ts`
- **CachedTTSOptions** (2 connections) — `services/tutor-agent/src/ttsCache.ts`
- **LANGUAGE_CODE** (2 connections) — `services/tutor-agent/src/voice.ts`
- **VOICE_SETTINGS** (2 connections) — `services/tutor-agent/src/voice.ts`
- **scriptedLines()** (2 connections) — `services/tutor-agent/src/warmCache.ts`
- **DEFAULT_CACHE_DIR** (1 connections) — `services/tutor-agent/src/voice.ts`
- **SETTINGS_FINGERPRINT** (1 connections) — `services/tutor-agent/src/voice.ts`
- **settingsFingerprint()** (1 connections) — `services/tutor-agent/src/voice.ts`
- **ENV_KEYS** (1 connections) — `services/tutor-agent/src/voice.test.ts`
- **splitter** (1 connections) — `services/tutor-agent/src/warmCache.ts`

## Relationships

- [Environment Preflight](Environment_Preflight.md) (5 shared connections)
- [Conversation Brain Spend](Conversation_Brain_Spend.md) (3 shared connections)
- [TTS Response Cache](TTS_Response_Cache.md) (3 shared connections)
- [Lesson Definitions Matching](Lesson_Definitions_Matching.md) (2 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (2 shared connections)
- [Review Deck Store](Review_Deck_Store.md) (1 shared connections)
- [Sign-In UI Components](Sign-In_UI_Components.md) (1 shared connections)
- [Drill Session Copy Checks](Drill_Session_Copy_Checks.md) (1 shared connections)
- [Mock Speech Session Screen](Mock_Speech_Session_Screen.md) (1 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (1 shared connections)

## Source Files

- `packages/core/src/lessons/index.ts`
- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/ttsCache.ts`
- `services/tutor-agent/src/voice.test.ts`
- `services/tutor-agent/src/voice.ts`
- `services/tutor-agent/src/warmCache.ts`

## Audit Trail

- EXTRACTED: 44 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*