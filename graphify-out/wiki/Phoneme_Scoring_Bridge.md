# Phoneme Scoring Bridge

> 15 nodes · cohesion 0.20

## Key Concepts

- **shared/speechace.ts** (10 connections) — `services/shared/speechace.ts`
- **speechace.test.ts** (10 connections) — `services/tutor-agent/src/speechace.test.ts`
- **scoreUtterance()** (9 connections) — `services/shared/speechace.ts`
- **phoneMap.ts** (6 connections) — `services/shared/phoneMap.ts`
- **toInventoryIpa()** (4 connections) — `services/shared/phoneMap.ts`
- **parseSpeechace()** (4 connections) — `services/shared/speechace.ts`
- **src/speechace.ts** (3 connections) — `services/tutor-agent/src/speechace.ts`
- **ALIASES** (1 connections) — `services/shared/phoneMap.ts`
- **FRENCH_IPA** (1 connections) — `services/shared/phoneMap.ts`
- **isInventoryIpa()** (1 connections) — `services/shared/phoneMap.ts`
- **ScoreFetch** (1 connections) — `services/shared/speechace.ts`
- **ScoreRequest** (1 connections) — `services/shared/speechace.ts`
- **recorder()** (1 connections) — `services/tutor-agent/src/speechace.test.ts`
- **RESPONSE** (1 connections) — `services/tutor-agent/src/speechace.test.ts`
- **withKey()** (1 connections) — `services/tutor-agent/src/speechace.test.ts`

## Relationships

- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (4 shared connections)
- [Token Server Endpoints](Token_Server_Endpoints.md) (3 shared connections)
- [Drill Bank and Design Tokens](Drill_Bank_and_Design_Tokens.md) (2 shared connections)
- [Lesson Session Grading](Lesson_Session_Grading.md) (1 shared connections)
- [LiveKit Tutor Agent](LiveKit_Tutor_Agent.md) (1 shared connections)
- [Conversation Ladder and Copy Rules](Conversation_Ladder_and_Copy_Rules.md) (1 shared connections)

## Source Files

- `services/shared/phoneMap.ts`
- `services/shared/speechace.ts`
- `services/tutor-agent/src/speechace.test.ts`
- `services/tutor-agent/src/speechace.ts`

## Audit Trail

- EXTRACTED: 32 (97%)
- INFERRED: 1 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*