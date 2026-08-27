# Parle Conversation Controller

> 59 nodes · cohesion 0.10

## Key Concepts

- **ParleConversation** (55 connections) — `services/tutor-agent/src/convo.ts`
- **buildSystemBlocks()** (23 connections) — `packages/brain/src/prompt/system.ts`
- **.runBrainTurn()** (19 connections) — `services/tutor-agent/src/convo.ts`
- **.finish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.publish()** (15 connections) — `services/tutor-agent/src/convo.ts`
- **.routeClientMessage()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **.startScene()** (14 connections) — `services/tutor-agent/src/convo.ts`
- **brainSpend.ts** (14 connections) — `services/tutor-agent/src/verify/brainSpend.ts`
- **.armRescue()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.curatePractice()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.generateDrills()** (12 connections) — `services/tutor-agent/src/convo.ts`
- **.clearRescue()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.extractMemory()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.handleSafety()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.say()** (11 connections) — `services/tutor-agent/src/convo.ts`
- **.buildFrame()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.open()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.openMission()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.recordBrainUsage()** (10 connections) — `services/tutor-agent/src/convo.ts`
- **.openScene()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.returnToChoosing()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **.onUserTurnCompleted()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.recordFailedCall()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.rescue()** (7 connections) — `services/tutor-agent/src/convo.ts`
- **.speak()** (7 connections) — `services/tutor-agent/src/convo.ts`
- *... and 34 more nodes in this community*

## Relationships

- [Conversation Orchestration](Conversation_Orchestration.md) (22 shared connections)
- [Session Recap Samples](Session_Recap_Samples.md) (15 shared connections)
- [LLM Usage Pricing](LLM_Usage_Pricing.md) (11 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (10 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (7 shared connections)
- [Live Failure Classification](Live_Failure_Classification.md) (5 shared connections)
- [Phrase Curation](Phrase_Curation.md) (5 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (4 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (4 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (3 shared connections)
- [Anthropic Brain Client](Anthropic_Brain_Client.md) (2 shared connections)
- [Tutor Agent Timing](Tutor_Agent_Timing.md) (2 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/llm/claudeCli.test.ts`
- `packages/brain/src/llm/split.test.ts`
- `packages/brain/src/prompt/system.ts`
- `services/tutor-agent/src/convo.ts`
- `services/tutor-agent/src/verify/brainSpend.ts`

## Audit Trail

- EXTRACTED: 269 (99%)
- INFERRED: 4 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*