# Live Conversation Orchestrator

> 23 nodes · cohesion 0.23

## Key Concepts

- **ParleConversation** (38 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.handleClientMessage()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.buildFrame()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.markTiming()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.publishError()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.silenceWindow()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **.setLearnerSpeaking()** (2 connections) — `services/tutor-agent/src/convo.ts`
- **.attachTiming()** (1 connections) — `services/tutor-agent/src/convo.ts`
- **.settled()** (1 connections) — `services/tutor-agent/src/convo.ts`

## Relationships

- [Conversation State Pipeline](Conversation_State_Pipeline.md) (19 shared connections)
- [Turn Integration & Copy Rules](Turn_Integration_&_Copy_Rules.md) (7 shared connections)
- [Conversation Engine Tests](Conversation_Engine_Tests.md) (5 shared connections)
- [Convo Frames & Usage](Convo_Frames_&_Usage.md) (4 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (3 shared connections)
- [LLM Client Adapters](LLM_Client_Adapters.md) (2 shared connections)
- [Live Failure Handling](Live_Failure_Handling.md) (2 shared connections)
- [Playground CLI Commands](Playground_CLI_Commands.md) (1 shared connections)
- [Profile Store & Upgrade](Profile_Store_&_Upgrade.md) (1 shared connections)
- [Agent Env Preflight](Agent_Env_Preflight.md) (1 shared connections)
- [Drill Generation Prompts](Drill_Generation_Prompts.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 103 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*