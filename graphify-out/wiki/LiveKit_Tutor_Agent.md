# LiveKit Tutor Agent

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

- [Agent Prompt And Turn Queue](Agent_Prompt_And_Turn_Queue.md) (9 shared connections)
- [Pronunciation Session Feedback](Pronunciation_Session_Feedback.md) (8 shared connections)
- [Mock Speech And Session Screen](Mock_Speech_And_Session_Screen.md) (3 shared connections)
- [App Agent Wire Protocol](App_Agent_Wire_Protocol.md) (3 shared connections)
- [Cafe Lesson Definitions](Cafe_Lesson_Definitions.md) (2 shared connections)
- [TTS Cache Streaming](TTS_Cache_Streaming.md) (2 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (1 shared connections)
- [Conversation Flow Orchestration](Conversation_Flow_Orchestration.md) (1 shared connections)
- [Session Domain Types](Session_Domain_Types.md) (1 shared connections)
- [Agent Usage Reporting](Agent_Usage_Reporting.md) (1 shared connections)
- [Safety Output Guard](Safety_Output_Guard.md) (1 shared connections)
- [Safety Policy Corpus Tests](Safety_Policy_Corpus_Tests.md) (1 shared connections)

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