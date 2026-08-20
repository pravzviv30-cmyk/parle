# Voice Cache Warming

> 8 nodes · cohesion 0.32

## Key Concepts

- **warmCache.ts** (12 connections) — `services/tutor-agent/src/warmCache.ts`
- **buildTTS()** (5 connections) — `services/tutor-agent/src/voice.ts`
- **CONVO_LINES** (3 connections) — `services/tutor-agent/src/convo.ts`
- **voice.test.ts** (3 connections) — `services/tutor-agent/src/voice.test.ts`
- **main()** (3 connections) — `services/tutor-agent/src/warmCache.ts`
- **scriptedLines()** (2 connections) — `services/tutor-agent/src/warmCache.ts`
- **ENV_KEYS** (1 connections) — `services/tutor-agent/src/voice.test.ts`
- **splitter** (1 connections) — `services/tutor-agent/src/warmCache.ts`

## Relationships

- [TTS Cache](TTS_Cache.md) (3 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (2 shared connections)
- [Zod Contract Schemas](Zod_Contract_Schemas.md) (2 shared connections)
- [Conversation Test Doubles](Conversation_Test_Doubles.md) (1 shared connections)
- [Agent Preflight Checks](Agent_Preflight_Checks.md) (1 shared connections)
- [Lesson Content Model](Lesson_Content_Model.md) (1 shared connections)
- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (1 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (1 shared connections)

## Source Files

- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/voice.test.ts`
- `services/tutor-agent/src/voice.ts`
- `services/tutor-agent/src/warmCache.ts`

## Audit Trail

- EXTRACTED: 21 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*