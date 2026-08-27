# Conversation Turn Orchestration

> 37 nodes · cohesion 0.17

## Key Concepts

- **ParleConversation** (55 connections) — `services/tutor-agent/src/convo.ts`
- **.runBrainTurn()** (19 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.routeClientMessage()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.armRescue()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.handleSafety()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.openMission()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.returnToChoosing()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **LearnerTurnInput** (6 connections) — `packages/brain/src/engine/conversation.ts`
- **.publishView()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.recover()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.publishError()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.releaseMoment()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **sttLanguageFor()** (5 connections) — `services/tutor-agent/src/convo.ts`
- **.deferForAMoment()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **.runRescue()** (4 connections) — `services/tutor-agent/src/convo.ts`
- *... and 12 more nodes in this community*

## Relationships

- [Conversation Brain Spend](Conversation_Brain_Spend.md) (18 shared connections)
- [Brain Contract Methods](Brain_Contract_Methods.md) (18 shared connections)
- [Coach Sample Fixtures](Coach_Sample_Fixtures.md) (12 shared connections)
- [Brain LLM Client Types](Brain_LLM_Client_Types.md) (4 shared connections)
- [Profile Extraction Updates](Profile_Extraction_Updates.md) (4 shared connections)
- [Profile Merge Fields](Profile_Merge_Fields.md) (3 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (2 shared connections)
- [Playground Chat CLI](Playground_Chat_CLI.md) (1 shared connections)
- [Mission Chooser View](Mission_Chooser_View.md) (1 shared connections)
- [Repo Conventions and Thinking Timer](Repo_Conventions_and_Thinking_Timer.md) (1 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (1 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 185 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*