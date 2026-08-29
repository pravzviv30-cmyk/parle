# TTS Voice Cache Build

> 16 nodes · cohesion 0.17

## Key Concepts

- **voice.ts** (17 connections) — `services/tutor-agent/src/voice.ts`
- **warmCache.ts** (12 connections) — `services/tutor-agent/src/warmCache.ts`
- **buildTTS()** (5 connections) — `services/tutor-agent/src/voice.ts`
- **voice.test.ts** (5 connections) — `services/tutor-agent/src/voice.test.ts`
- **CONVO_LINES** (3 connections) — `services/tutor-agent/src/convo.ts`
- **MODEL** (3 connections) — `services/tutor-agent/src/voice.ts`
- **PROBE_LINE** (3 connections) — `services/tutor-agent/src/voice.ts`
- **main()** (3 connections) — `services/tutor-agent/src/warmCache.ts`
- **LANGUAGE_CODE** (2 connections) — `services/tutor-agent/src/voice.ts`
- **VOICE_SETTINGS** (2 connections) — `services/tutor-agent/src/voice.ts`
- **scriptedLines()** (2 connections) — `services/tutor-agent/src/warmCache.ts`
- **DEFAULT_CACHE_DIR** (1 connections) — `services/tutor-agent/src/voice.ts`
- **SETTINGS_FINGERPRINT** (1 connections) — `services/tutor-agent/src/voice.ts`
- **settingsFingerprint()** (1 connections) — `services/tutor-agent/src/voice.ts`
- **ENV_KEYS** (1 connections) — `services/tutor-agent/src/voice.test.ts`
- **splitter** (1 connections) — `services/tutor-agent/src/warmCache.ts`

## Relationships

- [Environment Preflight Probes](Environment_Preflight_Probes.md) (7 shared connections)
- [Conversation Flow Orchestration](Conversation_Flow_Orchestration.md) (3 shared connections)
- [TTS Cache Streaming](TTS_Cache_Streaming.md) (3 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Brain Contract Zod Schemas](Brain_Contract_Zod_Schemas.md) (2 shared connections)
- [Cafe Lesson Definitions](Cafe_Lesson_Definitions.md) (1 shared connections)
- [Status Line & Tutor Name](Status_Line_&_Tutor_Name.md) (1 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/voice.test.ts`
- `services/tutor-agent/src/voice.ts`
- `services/tutor-agent/src/warmCache.ts`

## Audit Trail

- EXTRACTED: 41 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*