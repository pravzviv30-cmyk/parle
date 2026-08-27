# LLM Usage Pricing

> 74 nodes · cohesion 0.07

## Key Concepts

- **sessionLoop.ts** (43 connections) — `services/brain-playground/src/sessionLoop.ts`
- **runEval.ts** (38 connections) — `services/brain-playground/src/eval/runEval.ts`
- **chat.ts** (37 connections) — `services/brain-playground/src/chat.ts`
- **src/render.ts** (26 connections) — `services/brain-playground/src/render.ts`
- **LearnerProfile** (21 connections) — `packages/brain/src/profile/profile.ts`
- **frameEval.ts** (19 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **main()** (18 connections) — `services/brain-playground/src/chat.ts`
- **addLlmUsage()** (17 connections) — `packages/brain/src/llm/client.ts`
- **drillEval.ts** (17 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **brain-playground/src/usage.ts** (16 connections) — `services/brain-playground/src/usage.ts`
- **runInput()** (13 connections) — `services/brain-playground/src/sessionLoop.ts`
- **costUsd()** (12 connections) — `packages/brain/src/llm/pricing.ts`
- **runCase()** (11 connections) — `services/brain-playground/src/eval/runEval.ts`
- **ZERO_USAGE** (10 connections) — `packages/brain/src/llm/client.ts`
- **pricing.ts** (10 connections) — `packages/brain/src/llm/pricing.ts`
- **defaultModel()** (9 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **buildScenarioRequest()** (8 connections) — `packages/brain/src/prompt/scenarioPrompt.ts`
- **commands.ts** (8 connections) — `services/brain-playground/src/commands.ts`
- **meta** (8 connections) — `services/brain-playground/src/render.ts`
- **renderRecap()** (8 connections) — `services/brain-playground/src/render.ts`
- **beginSession()** (8 connections) — `services/brain-playground/src/sessionLoop.ts`
- **formatTurnUsage()** (8 connections) — `services/brain-playground/src/usage.ts`
- **priceUsage()** (7 connections) — `packages/brain/src/llm/pricing.ts`
- **pricing.test.ts** (7 connections) — `packages/brain/src/llm/pricing.test.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/drillEval.ts`
- *... and 49 more nodes in this community*

## Relationships

- [Session Recap Samples](Session_Recap_Samples.md) (38 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (35 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (14 shared connections)
- [Anthropic Brain Client](Anthropic_Brain_Client.md) (13 shared connections)
- [Parle Conversation Controller](Parle_Conversation_Controller.md) (11 shared connections)
- [Conversation Orchestration](Conversation_Orchestration.md) (10 shared connections)
- [HTTP & OpenAI Transport](HTTP_&_OpenAI_Transport.md) (10 shared connections)
- [Brain Zod Schemas](Brain_Zod_Schemas.md) (9 shared connections)
- [Learner Profile Updates](Learner_Profile_Updates.md) (9 shared connections)
- [Live Session Hook Tests](Live_Session_Hook_Tests.md) (9 shared connections)
- [Profile Store & Gate](Profile_Store_&_Gate.md) (4 shared connections)
- [Phrase Curation](Phrase_Curation.md) (3 shared connections)

## Source Files

- `packages/brain/src/frenchLeak.ts`
- `packages/brain/src/llm/client.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `packages/brain/src/llm/openaiResponses.ts`
- `packages/brain/src/llm/pricing.test.ts`
- `packages/brain/src/llm/pricing.ts`
- `packages/brain/src/profile/profile.ts`
- `packages/brain/src/prompt/scenarioPrompt.ts`
- `services/brain-playground/src/chat.ts`
- `services/brain-playground/src/commands.test.ts`
- `services/brain-playground/src/commands.ts`
- `services/brain-playground/src/eval/drillEval.ts`
- `services/brain-playground/src/eval/frameEval.ts`
- `services/brain-playground/src/eval/runEval.ts`
- `services/brain-playground/src/render.ts`
- `services/brain-playground/src/sessionLoop.test.ts`
- `services/brain-playground/src/sessionLoop.ts`
- `services/brain-playground/src/usage.ts`

## Audit Trail

- EXTRACTED: 362 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*