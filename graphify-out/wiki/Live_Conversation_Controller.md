# Live Conversation Controller

> 56 nodes · cohesion 0.11

## Key Concepts

- **ParleConversation** (63 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (20 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (16 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.routeClientMessage()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.curatePractice()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.handleSafety()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.openMission()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.buildFrame()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.recordBrainUsage()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.returnToChoosing()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.recordFailedCall()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- *... and 31 more nodes in this community*

## Relationships

- [Conversation Flow Orchestration](Conversation_Flow_Orchestration.md) (24 shared connections)
- [Coach Output Samples And Checks](Coach_Output_Samples_And_Checks.md) (12 shared connections)
- [Claude CLI Run And Usage](Claude_CLI_Run_And_Usage.md) (6 shared connections)
- [Brain Playground Chat CLI](Brain_Playground_Chat_CLI.md) (6 shared connections)
- [Claude CLI Brain Client](Claude_CLI_Brain_Client.md) (6 shared connections)
- [Topic Curation Pipeline](Topic_Curation_Pipeline.md) (4 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (4 shared connections)
- [Brain Spend Metering Tests](Brain_Spend_Metering_Tests.md) (3 shared connections)
- [App Agent Wire Protocol](App_Agent_Wire_Protocol.md) (2 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Agent Prompt And Turn Queue](Agent_Prompt_And_Turn_Queue.md) (2 shared connections)
- [Safety Output Guard](Safety_Output_Guard.md) (2 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 257 (98%)
- INFERRED: 6 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*