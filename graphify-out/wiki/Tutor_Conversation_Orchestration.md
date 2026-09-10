# Tutor Conversation Orchestration

> 61 nodes · cohesion 0.10

## Key Concepts

- **LuvaniConversation** (65 connections) — `services/tutor-agent/src/convo.ts`
- **buildSystemBlocks()** (28 connections) — `packages/brain/src/prompt/system.ts`
- **.runBrainTurn()** (21 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (17 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (16 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (16 connections) — `services/tutor-agent/src/convo.ts`
- **.routeClientMessage()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.constructor()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.curatePractice()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.handleSafety()** (13 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.openMission()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.buildFrame()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.recordBrainUsage()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.curateAndDrill()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **SessionRecap** (8 connections) — `packages/brain/src/contract/types.ts`
- **.returnToChoosing()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.conversationPackFor()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (7 connections) — `services/tutor-agent/src/convo.ts`
- *... and 36 more nodes in this community*

## Relationships

- [Conversation Packs](Conversation_Packs.md) (34 shared connections)
- [French Authenticity Checks](French_Authenticity_Checks.md) (18 shared connections)
- [Conversation State Pricing](Conversation_State_Pricing.md) (13 shared connections)
- [Brain LLM Client](Brain_LLM_Client.md) (12 shared connections)
- [Profile Error Tagging](Profile_Error_Tagging.md) (10 shared connections)
- [Content Curation Logic](Content_Curation_Logic.md) (7 shared connections)
- [Drill Generation Schemas](Drill_Generation_Schemas.md) (3 shared connections)
- [agent.ts](agent.ts.md) (3 shared connections)
- [Tutor Turn Queue](Tutor_Turn_Queue.md) (3 shared connections)
- [Brain Schema Definitions](Brain_Schema_Definitions.md) (2 shared connections)
- [Claude CLI Run Recording](Claude_CLI_Run_Recording.md) (2 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (2 shared connections)

## Source Files

- `packages/brain/src/contract/types.ts`
- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/llm/split.test.ts`
- `packages/brain/src/prompt/system.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 315 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*