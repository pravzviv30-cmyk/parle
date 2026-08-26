# LiveKit Tutor Agent

> 22 nodes · cohesion 0.25

## Key Concepts

- **ParleTutor** (26 connections) — `services/tutor-agent/src/tutor.ts`
- **currentPrompt()** (13 connections) — `packages/core/src/session/session.ts`
- **.applyInput()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.finish()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleClientMessage()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.onUserTurnCompleted()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.publish()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.armRescue()** (7 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleSafety()** (7 connections) — `services/tutor-agent/src/tutor.ts`
- **.enqueue()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendCurrentPrompt()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **rescueOnce()** (5 connections) — `services/tutor-agent/src/tutor.test.ts`
- **.publishError()** (4 connections) — `services/tutor-agent/src/tutor.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/tutor.ts`
- **.attach()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.replyOptions()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.sessionId()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.sessionState()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.setLearnerSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.settled()** (2 connections) — `services/tutor-agent/src/tutor.ts`

## Relationships

- [Tutor Prompt Building](Tutor_Prompt_Building.md) (11 shared connections)
- [Session Grading and Feedback](Session_Grading_and_Feedback.md) (7 shared connections)
- [Mock Speech Session](Mock_Speech_Session.md) (3 shared connections)
- [App Agent Protocol](App_Agent_Protocol.md) (3 shared connections)
- [TTS Audio Cache](TTS_Audio_Cache.md) (2 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (1 shared connections)
- [Safety Content Filters](Safety_Content_Filters.md) (1 shared connections)
- [Pronunciation Scoring](Pronunciation_Scoring.md) (1 shared connections)
- [Brain Client Activity Metering](Brain_Client_Activity_Metering.md) (1 shared connections)

## Source Files

- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.test.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 83 (94%)
- INFERRED: 5 (6%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*