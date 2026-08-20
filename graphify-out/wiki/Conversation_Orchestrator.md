# Conversation Orchestrator

> 33 nodes · cohesion 0.16

## Key Concepts

- **ParleConversation** (39 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.handleClientMessage()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **supportViewFor()** (8 connections) — `packages/brain/src/engine/conversation.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **sttLanguageFor()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.markTiming()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.publishError()** (3 connections) — `services/tutor-agent/src/convo.ts`
- *... and 8 more nodes in this community*

## Relationships

- [Learner Profile Model](Learner_Profile_Model.md) (13 shared connections)
- [Conversation Test Doubles](Conversation_Test_Doubles.md) (7 shared connections)
- [Tutor Copy Rules](Tutor_Copy_Rules.md) (6 shared connections)
- [Conversation State and Recap](Conversation_State_and_Recap.md) (5 shared connections)
- [Playground Eval Harness](Playground_Eval_Harness.md) (4 shared connections)
- [Playground Chat Commands](Playground_Chat_Commands.md) (3 shared connections)
- [Conversation Ladder and Copy Rules](Conversation_Ladder_and_Copy_Rules.md) (3 shared connections)
- [Memory Curation](Memory_Curation.md) (3 shared connections)
- [Client Agent Wire Protocol](Client_Agent_Wire_Protocol.md) (2 shared connections)
- [Agent Preflight Checks](Agent_Preflight_Checks.md) (2 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (1 shared connections)
- [Memory Extraction Prompt](Memory_Extraction_Prompt.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 137 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*