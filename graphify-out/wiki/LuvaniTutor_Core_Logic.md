# LuvaniTutor Core Logic

> 27 nodes · cohesion 0.20

## Key Concepts

- **LuvaniTutor** (33 connections) — `services/tutor-agent/src/tutor.ts`
- **currentPrompt()** (14 connections) — `packages/core/src/session/session.ts`
- **.handleClientMessage()** (11 connections) — `services/tutor-agent/src/tutor.ts`
- **.applyInput()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.armRescue()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.finish()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.onUserTurnCompleted()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.publish()** (9 connections) — `services/tutor-agent/src/tutor.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleSafety()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.constructor()** (7 connections) — `services/tutor-agent/src/tutor.ts`
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
- **.setLearnerSpeaking()** (2 connections) — `services/tutor-agent/src/tutor.ts`
- *... and 2 more nodes in this community*

## Relationships

- [Mock Speech Session](Mock_Speech_Session.md) (11 shared connections)
- [Brain Prompt & Turn Queue](Brain_Prompt_&_Turn_Queue.md) (10 shared connections)
- [Client-Agent Protocol](Client-Agent_Protocol.md) (3 shared connections)
- [Lesson Content Definitions](Lesson_Content_Definitions.md) (2 shared connections)
- [Onboarding Voice Step](Onboarding_Voice_Step.md) (2 shared connections)
- [Utterance Capture](Utterance_Capture.md) (2 shared connections)
- [Turn Timing Metrics](Turn_Timing_Metrics.md) (1 shared connections)
- [Conversation Test Fixtures](Conversation_Test_Fixtures.md) (1 shared connections)
- [Situation Chooser UI](Situation_Chooser_UI.md) (1 shared connections)
- [Conversation Engine Core](Conversation_Engine_Core.md) (1 shared connections)
- [Safety Output Guard](Safety_Output_Guard.md) (1 shared connections)
- [Safety Policy Records](Safety_Policy_Records.md) (1 shared connections)

## Source Files

- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.test.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 103 (95%)
- INFERRED: 5 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*