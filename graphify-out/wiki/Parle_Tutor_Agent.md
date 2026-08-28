# Parle Tutor Agent

> 28 nodes · cohesion 0.19

## Key Concepts

- **ParleTutor** (32 connections) — `services/tutor-agent/src/tutor.ts`
- **currentPrompt()** (13 connections) — `packages/core/src/session/session.ts`
- **.handleClientMessage()** (11 connections) — `services/tutor-agent/src/tutor.ts`
- **.applyInput()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.armRescue()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.finish()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.onUserTurnCompleted()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.publish()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleSafety()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.constructor()** (6 connections) — `services/tutor-agent/src/tutor.ts`
- **.enqueue()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.runRescue()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendCurrentPrompt()** (5 connections) — `services/tutor-agent/src/tutor.ts`
- **rescueOnce()** (5 connections) — `services/tutor-agent/src/tutor.test.ts`
- **.closeAfterStop()** (4 connections) — `services/tutor-agent/src/tutor.ts`
- **.attach()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.publishError()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.replyOptions()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.sessionId()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.setVoiceless()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.silenceWindow()** (3 connections) — `services/tutor-agent/src/tutor.ts`
- **.closeRoom()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.sendSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- **.sessionState()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- *... and 3 more nodes in this community*

## Relationships

- [Session and Attempt Scoring](Session_and_Attempt_Scoring.md) (9 shared connections)
- [Thinking and Session Reporting](Thinking_and_Session_Reporting.md) (8 shared connections)
- [Client Server Protocol](Client_Server_Protocol.md) (3 shared connections)
- [Mock Speech Session Screen](Mock_Speech_Session_Screen.md) (2 shared connections)
- [Lesson Definitions](Lesson_Definitions.md) (2 shared connections)
- [TTS Audio Cache](TTS_Audio_Cache.md) (2 shared connections)
- [Tutor Agent Prompt](Tutor_Agent_Prompt.md) (2 shared connections)
- [Agent Turn Timing](Agent_Turn_Timing.md) (1 shared connections)
- [Conversation Engine Tests](Conversation_Engine_Tests.md) (1 shared connections)
- [Drill Chooser View](Drill_Chooser_View.md) (1 shared connections)
- [Safety Decision Guard](Safety_Decision_Guard.md) (1 shared connections)
- [Safety Policy Records](Safety_Policy_Records.md) (1 shared connections)

## Source Files

- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.test.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 101 (95%)
- INFERRED: 5 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*