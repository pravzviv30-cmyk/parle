# Conversation Orchestration

> 60 nodes · cohesion 0.05

## Key Concepts

- **convo.ts** (106 connections) — `services/tutor-agent/src/convo.ts`
- **convo.test.ts** (92 connections) — `services/tutor-agent/src/convo.test.ts`
- **.constructor()** (9 connections) — `services/tutor-agent/src/convo.ts`
- **formatBrainSummary()** (8 connections) — `services/tutor-agent/src/convo.ts`
- **buildConvo()** (7 connections) — `services/tutor-agent/src/convo.test.ts`
- **brainClient()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **missionOpening()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **seededOpening()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **FailingBrain** (4 connections) — `services/tutor-agent/src/convo.test.ts`
- **inScene()** (4 connections) — `services/tutor-agent/src/convo.test.ts`
- **validMissionId()** (4 connections) — `services/tutor-agent/src/convo.ts`
- **cacheHitRate()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **chargedInput()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **chooseFrame()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **openerFor()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **spokenTurn()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **finishSessionWith()** (3 connections) — `services/tutor-agent/src/convo.test.ts`
- **missionScene()** (3 connections) — `services/tutor-agent/src/convo.test.ts`
- **NoCuration** (3 connections) — `services/tutor-agent/src/convo.test.ts`
- **NoFrameBrain** (3 connections) — `services/tutor-agent/src/convo.test.ts`
- **tapped()** (3 connections) — `services/tutor-agent/src/convo.test.ts`
- **toConvoView()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **toRecapPayload()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **turnIsUninterruptible()** (3 connections) — `services/tutor-agent/src/convo.ts`
- **validSeedTopic()** (3 connections) — `services/tutor-agent/src/convo.ts`
- *... and 35 more nodes in this community*

## Relationships

- [Brain Client Contracts](Brain_Client_Contracts.md) (22 shared connections)
- [Parle Conversation Controller](Parle_Conversation_Controller.md) (22 shared connections)
- [Session Recap Samples](Session_Recap_Samples.md) (21 shared connections)
- [Tutor Prompt Building](Tutor_Prompt_Building.md) (10 shared connections)
- [LLM Usage Pricing](LLM_Usage_Pricing.md) (10 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (10 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (9 shared connections)
- [Live Failure Classification](Live_Failure_Classification.md) (8 shared connections)
- [Environment Preflight](Environment_Preflight.md) (6 shared connections)
- [Phrase Curation](Phrase_Curation.md) (6 shared connections)
- [Test Brain Doubles](Test_Brain_Doubles.md) (6 shared connections)
- [Tutor Agent Timing](Tutor_Agent_Timing.md) (4 shared connections)

## Source Files

- `packages/brain/src/engine/conversation.ts`
- `services/tutor-agent/src/convo.test.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 244 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*