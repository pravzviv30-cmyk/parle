# LiveKit Tutor Agent

> 20 nodes · cohesion 0.25

## Key Concepts

- **ParleTutor** (24 connections) — `services/tutor-agent/src/tutor.ts`
- **Lesson** (15 connections) — `packages/core/src/lessons/types.ts`
- **currentPrompt()** (13 connections) — `packages/core/src/session/session.ts`
- **.applyInput()** (10 connections) — `services/tutor-agent/src/tutor.ts`
- **.handleClientMessage()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.onUserTurnCompleted()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.publish()** (8 connections) — `services/tutor-agent/src/tutor.ts`
- **.finish()** (7 connections) — `services/tutor-agent/src/tutor.ts`
- **.armRescue()** (6 connections) — `services/tutor-agent/src/tutor.ts`
- **.constructor()** (6 connections) — `services/tutor-agent/src/tutor.ts`
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

- [Lesson Session Grading](Lesson_Session_Grading.md) (11 shared connections)
- [Prompt and Turn Queue](Prompt_and_Turn_Queue.md) (7 shared connections)
- [Client Agent Wire Protocol](Client_Agent_Wire_Protocol.md) (5 shared connections)
- [Mock Speech Session Screen](Mock_Speech_Session_Screen.md) (3 shared connections)
- [Conversation Ladder and Copy Rules](Conversation_Ladder_and_Copy_Rules.md) (2 shared connections)
- [Shared UI Components](Shared_UI_Components.md) (2 shared connections)
- [Agent Preflight Checks](Agent_Preflight_Checks.md) (2 shared connections)
- [Lesson Content Model](Lesson_Content_Model.md) (2 shared connections)
- [Utterance Audio Capture](Utterance_Audio_Capture.md) (2 shared connections)
- [Drill Bank and Design Tokens](Drill_Bank_and_Design_Tokens.md) (1 shared connections)
- [Tab Bar Icons](Tab_Bar_Icons.md) (1 shared connections)
- [Phoneme Scoring Bridge](Phoneme_Scoring_Bridge.md) (1 shared connections)

## Source Files

- `packages/core/src/lessons/types.ts`
- `packages/core/src/session/session.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 87 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*