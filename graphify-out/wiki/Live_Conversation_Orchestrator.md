# Live Conversation Orchestrator

> 30 nodes · cohesion 0.19

## Key Concepts

- **ParleConversation** (39 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.handleClientMessage()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.markTiming()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.publishError()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.silenceWindow()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.conversationState()** (2 connections) — `services/tutor-agent/src/convo.ts`
- *... and 5 more nodes in this community*

## Relationships

- [Tutor Tab Curation](Tutor_Tab_Curation.md) (9 shared connections)
- [Conversation State Machine](Conversation_State_Machine.md) (9 shared connections)
- [Conversation Agent Tests](Conversation_Agent_Tests.md) (5 shared connections)
- [Brain Evaluation Harness](Brain_Evaluation_Harness.md) (4 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (4 shared connections)
- [Learner Copy Rules](Learner_Copy_Rules.md) (3 shared connections)
- [Brain Playground CLI](Brain_Playground_CLI.md) (2 shared connections)
- [Client Agent Protocol](Client_Agent_Protocol.md) (2 shared connections)
- [Profile Store And Migration](Profile_Store_And_Migration.md) (1 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (1 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (1 shared connections)
- [Memory Extraction Prompt](Memory_Extraction_Prompt.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 126 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*