# Live Tutor Agent

> 18 nodes · cohesion 0.29

## Key Concepts

- **ParleTutor** (24 connections) — `services/tutor-agent/src/tutor.ts`
- **currentPrompt()** (13 connections) — `packages/core/src/session/session.ts`
- **.applyInput()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleClientMessage()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.onUserTurnCompleted()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.publish()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.finish()** (7 connections) — `services/tutor-agent/src/tutor.ts`
- **.armRescue()** (6 connections) — `services/tutor-agent/src/tutor.ts`
- **.clearRescue()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.enqueue()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendCurrentPrompt()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.replyOptions()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.runRescue()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.publishError()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.sessionState()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.setLearnerSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.settled()** (1 connections) — `services/tutor-agent/src/tutor.ts`

## Relationships

- [Lesson Turn Grading](Lesson_Turn_Grading.md) (8 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (6 shared connections)
- [Client Agent Protocol](Client_Agent_Protocol.md) (5 shared connections)
- [Mock Speech Session](Mock_Speech_Session.md) (2 shared connections)
- [TTS Audio Caching](TTS_Audio_Caching.md) (2 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (1 shared connections)
- [Tutor Tab Curation](Tutor_Tab_Curation.md) (1 shared connections)
- [Token Server Endpoints](Token_Server_Endpoints.md) (1 shared connections)

## Source Files

- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 70 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*