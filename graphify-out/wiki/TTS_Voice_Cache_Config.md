# TTS Voice Cache Config

> 15 nodes · cohesion 0.19

## Key Concepts

- **voice.ts** (17 connections) — `services/tutor-agent/src/voice.ts`
- **warmCache.ts** (12 connections) — `services/tutor-agent/src/warmCache.ts`
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
- [Conversation Orchestration](Conversation_Orchestration.md) (3 shared connections)
- [TTS Audio Cache](TTS_Audio_Cache.md) (3 shared connections)
- [Tutor Agent Timing](Tutor_Agent_Timing.md) (2 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (2 shared connections)
- [Lesson Definitions](Lesson_Definitions.md) (1 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/ttsCache.ts`
- `services/tutor-agent/src/voice.test.ts`
- `services/tutor-agent/src/voice.ts`
- `services/tutor-agent/src/warmCache.ts`

## Audit Trail

- EXTRACTED: 38 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*