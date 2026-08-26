# LLM Usage Pricing

> 39 nodes · cohesion 0.11

## Key Concepts

- **runEval.ts** (38 connections) — `services/brain-playground/src/eval/runEval.ts`
- **frameEval.ts** (19 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **addLlmUsage()** (17 connections) — `packages/brain/src/llm/client.ts`
- **drillEval.ts** (17 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **brain-playground/src/usage.ts** (16 connections) — `services/brain-playground/src/usage.ts`
- **costUsd()** (12 connections) — `packages/brain/src/llm/pricing.ts`
- **runCase()** (11 connections) — `services/brain-playground/src/eval/runEval.ts`
- **ZERO_USAGE** (10 connections) — `packages/brain/src/llm/client.ts`
- **pricing.ts** (10 connections) — `packages/brain/src/llm/pricing.ts`
- **defaultModel()** (9 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **buildScenarioRequest()** (8 connections) — `packages/brain/src/prompt/scenarioPrompt.ts`
- **formatTurnUsage()** (8 connections) — `services/brain-playground/src/usage.ts`
- **priceUsage()** (7 connections) — `packages/brain/src/llm/pricing.ts`
- **pricing.test.ts** (7 connections) — `packages/brain/src/llm/pricing.test.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **carriesFrench()** (6 connections) — `packages/brain/src/frenchLeak.ts`
- **main()** (6 connections) — `services/brain-playground/src/eval/runEval.ts`
- **DEFAULT_OPENAI_ANALYST_MODEL** (5 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **formatSessionUsage()** (5 connections) — `services/brain-playground/src/usage.ts`
- **checkFrame()** (4 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **pricedNote()** (4 connections) — `services/brain-playground/src/usage.ts`
- **USD_PER_MTOK** (3 connections) — `packages/brain/src/llm/pricing.ts`
- **hardRules()** (3 connections) — `services/brain-playground/src/eval/runEval.ts`
- **pickClient()** (3 connections) — `services/brain-playground/src/eval/runEval.ts`
- *... and 14 more nodes in this community*

## Relationships

- [Brain Client Contracts](Brain_Client_Contracts.md) (19 shared connections)
- [Playground Chat Commands](Playground_Chat_Commands.md) (17 shared connections)
- [Conversation State Machine](Conversation_State_Machine.md) (9 shared connections)
- [Brain Schemas and Samples](Brain_Schemas_and_Samples.md) (8 shared connections)
- [OpenAI Responses Brain Client](OpenAI_Responses_Brain_Client.md) (8 shared connections)
- [Brain Client Activity Metering](Brain_Client_Activity_Metering.md) (7 shared connections)
- [Conversation Orchestration](Conversation_Orchestration.md) (7 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (6 shared connections)
- [OpenAI Compatible HTTP Client](OpenAI_Compatible_HTTP_Client.md) (5 shared connections)
- [Anthropic Brain Client](Anthropic_Brain_Client.md) (4 shared connections)
- [Copy Style Rules](Copy_Style_Rules.md) (4 shared connections)
- [Coach Surfacing Policy](Coach_Surfacing_Policy.md) (3 shared connections)

## Source Files

- `packages/brain/src/frenchLeak.ts`
- `packages/brain/src/llm/client.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `packages/brain/src/llm/openaiResponses.ts`
- `packages/brain/src/llm/pricing.test.ts`
- `packages/brain/src/llm/pricing.ts`
- `packages/brain/src/prompt/scenarioPrompt.ts`
- `services/brain-playground/src/eval/drillEval.ts`
- `services/brain-playground/src/eval/frameEval.ts`
- `services/brain-playground/src/eval/runEval.ts`
- `services/brain-playground/src/usage.ts`

## Audit Trail

- EXTRACTED: 185 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*