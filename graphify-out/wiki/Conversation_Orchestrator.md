# Conversation Orchestrator

> 31 nodes · cohesion 0.18

## Key Concepts

- **ParleConversation** (39 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.handleClientMessage()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.buildFrame()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.markTiming()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.publishError()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.silenceWindow()** (3 connections) — `services/tutor-agent/src/convo.ts`
- *... and 6 more nodes in this community*

## Relationships

- [Conversation View and Profile Parsing](Conversation_View_and_Profile_Parsing.md) (12 shared connections)
- [Session Recap Contract Types](Session_Recap_Contract_Types.md) (8 shared connections)
- [Drill Eval Harness](Drill_Eval_Harness.md) (5 shared connections)
- [Learner Profile and Support](Learner_Profile_and_Support.md) (5 shared connections)
- [Topic Curation Prompt](Topic_Curation_Prompt.md) (4 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (3 shared connections)
- [Brain LLM Client Schemas](Brain_LLM_Client_Schemas.md) (2 shared connections)
- [Client Agent Wire Protocol](Client_Agent_Wire_Protocol.md) (2 shared connections)
- [App Root and Profile Gate](App_Root_and_Profile_Gate.md) (1 shared connections)
- [Agent Preflight and Env](Agent_Preflight_and_Env.md) (1 shared connections)
- [Memory Extraction Prompt](Memory_Extraction_Prompt.md) (1 shared connections)
- [Drill Grading and Fixtures](Drill_Grading_and_Fixtures.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 128 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*