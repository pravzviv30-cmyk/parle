# TTS Voice Cache Config

> 17 nodes · cohesion 0.16

## Key Concepts

- **voice.ts** (17 connections) — `services/tutor-agent/src/voice.ts`
- **warmCache.ts** (12 connections) — `services/tutor-agent/src/warmCache.ts`
- **buildTTS()** (5 connections) — `services/tutor-agent/src/voice.ts`
- **voice.test.ts** (5 connections) — `services/tutor-agent/src/voice.test.ts`
- **CONVO_LINES** (3 connections) — `services/tutor-agent/src/convo.ts`
- **MODEL** (3 connections) — `services/tutor-agent/src/voice.ts`
- **PROBE_LINE** (3 connections) — `services/tutor-agent/src/voice.ts`
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

- [Environment Preflight](Environment_Preflight.md) (7 shared connections)
- [Conversation Brain Client](Conversation_Brain_Client.md) (3 shared connections)
- [TTS Caching Layer](TTS_Caching_Layer.md) (3 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Sample Fixtures And Copy](Sample_Fixtures_And_Copy.md) (2 shared connections)
- [Lesson Definitions](Lesson_Definitions.md) (1 shared connections)
- [Drill Merge And Scene Controls](Drill_Merge_And_Scene_Controls.md) (1 shared connections)
- [Brain CLI Playground](Brain_CLI_Playground.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/ttsCache.ts`
- `services/tutor-agent/src/voice.test.ts`
- `services/tutor-agent/src/voice.ts`
- `services/tutor-agent/src/warmCache.ts`

## Audit Trail

- EXTRACTED: 42 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*