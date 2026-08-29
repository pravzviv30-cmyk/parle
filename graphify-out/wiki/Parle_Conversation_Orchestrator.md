# Parle Conversation Orchestrator

> 58 nodes · cohesion 0.11

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
- **.curateAndDrill()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **.guardLine()** (6 connections) — `services/tutor-agent/src/convo.ts`
- *... and 33 more nodes in this community*

## Relationships

- [Conversation Brain Client](Conversation_Brain_Client.md) (26 shared connections)
- [Sample Fixtures And Copy](Sample_Fixtures_And_Copy.md) (13 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (8 shared connections)
- [Brain LLM Schemas](Brain_LLM_Schemas.md) (6 shared connections)
- [App Agent Protocol](App_Agent_Protocol.md) (5 shared connections)
- [Brain CLI Playground](Brain_CLI_Playground.md) (4 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (4 shared connections)
- [Topic Curation](Topic_Curation.md) (4 shared connections)
- [LLM Usage Pricing](LLM_Usage_Pricing.md) (3 shared connections)
- [Turn Timing Instrumentation](Turn_Timing_Instrumentation.md) (2 shared connections)
- [Prompt And Turn Queue](Prompt_And_Turn_Queue.md) (2 shared connections)
- [Output Safety Guard](Output_Safety_Guard.md) (2 shared connections)

## Source Files

- `services/tutor-agent/src/convo.test.ts`
- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/tutor.ts`

## Audit Trail

- EXTRACTED: 261 (98%)
- INFERRED: 5 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*