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

- [Mock Speech Session Screen](Mock_Speech_Session_Screen.md) (8 shared connections)
- [Lesson Session Engine](Lesson_Session_Engine.md) (8 shared connections)
- [Client Agent Wire Protocol](Client_Agent_Wire_Protocol.md) (5 shared connections)
- [Cached TTS Audio Stream](Cached_TTS_Audio_Stream.md) (2 shared connections)
- [Agent Preflight and Env](Agent_Preflight_and_Env.md) (1 shared connections)
- [Conversation View and Profile Parsing](Conversation_View_and_Profile_Parsing.md) (1 shared connections)
- [French Phoneme Mapping](French_Phoneme_Mapping.md) (1 shared connections)

## Source Files

- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 70 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*