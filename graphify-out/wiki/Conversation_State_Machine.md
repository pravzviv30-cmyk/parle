# Conversation State Machine

> 27 nodes · cohesion 0.13

## Key Concepts

- **conversation.ts** (75 connections) — `packages/brain/src/engine/conversation.ts`
- **createConversation()** (26 connections) — `packages/brain/src/engine/conversation.ts`
- **integrateTurn()** (24 connections) — `packages/brain/src/engine/conversation.ts`
- **prepareTurn()** (16 connections) — `packages/brain/src/engine/conversation.ts`
- **TurnView** (11 connections) — `packages/brain/src/engine/conversation.ts`
- **CoachItem** (7 connections) — `packages/brain/src/contract/types.ts`
- **SupportView** (6 connections) — `packages/brain/src/contract/types.ts`
- **realRecap()** (6 connections) — `services/tutor-agent/src/convo.test.ts`
- **sanitizeTurn()** (5 connections) — `packages/brain/src/engine/conversation.ts`
- **normalizeErrorTag()** (5 connections) — `packages/brain/src/profile/errorTag.ts`
- **sanitizeLearnerText()** (4 connections) — `packages/brain/src/copy.ts`
- **learnerSideSupport()** (4 connections) — `packages/brain/src/engine/conversation.ts`
- **openingRungFor()** (4 connections) — `packages/brain/src/engine/conversation.ts`
- **repairOpeningNarration()** (4 connections) — `packages/brain/src/engine/conversation.ts`
- **RescueView** (4 connections) — `packages/brain/src/engine/conversation.ts`
- **buildTurnContext()** (4 connections) — `packages/brain/src/prompt/turnContext.ts`
- **SpeakerLine** (3 connections) — `packages/brain/src/contract/types.ts`
- **beatOf()** (3 connections) — `packages/brain/src/engine/conversation.ts`
- **learnerMessageFor()** (3 connections) — `packages/brain/src/engine/conversation.ts`
- **turnRequest()** (3 connections) — `packages/brain/src/llm/client.test.ts`
- **errorTag.ts** (3 connections) — `packages/brain/src/profile/errorTag.ts`
- **frameMessage()** (2 connections) — `packages/brain/src/engine/conversation.ts`
- **inputKindOf()** (2 connections) — `packages/brain/src/engine/conversation.ts`
- **fresh()** (2 connections) — `packages/brain/src/engine/conversation.test.ts`
- **endedState()** (2 connections) — `packages/brain/src/profile/profile.test.ts`
- *... and 2 more nodes in this community*

## Relationships

- [Brain Schemas and Samples](Brain_Schemas_and_Samples.md) (25 shared connections)
- [Playground Chat Commands](Playground_Chat_Commands.md) (13 shared connections)
- [Scenario and Turn Prompts](Scenario_and_Turn_Prompts.md) (11 shared connections)
- [Brain Client Activity Metering](Brain_Client_Activity_Metering.md) (11 shared connections)
- [Copy Style Rules](Copy_Style_Rules.md) (10 shared connections)
- [Difficulty Ladder](Difficulty_Ladder.md) (10 shared connections)
- [LLM Usage Pricing](LLM_Usage_Pricing.md) (9 shared connections)
- [Conversation Orchestration](Conversation_Orchestration.md) (8 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (8 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (7 shared connections)
- [Coach Surfacing Policy](Coach_Surfacing_Policy.md) (6 shared connections)
- [Session Recap Assembly](Session_Recap_Assembly.md) (6 shared connections)

## Source Files

- `packages/brain/src/contract/types.ts`
- `packages/brain/src/copy.ts`
- `packages/brain/src/engine/conversation.test.ts`
- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/llm/client.test.ts`
- `packages/brain/src/profile/errorTag.ts`
- `packages/brain/src/profile/profile.test.ts`
- `packages/brain/src/prompt/turnContext.ts`
- `services/tutor-agent/src/convo.test.ts`

## Audit Trail

- EXTRACTED: 184 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*