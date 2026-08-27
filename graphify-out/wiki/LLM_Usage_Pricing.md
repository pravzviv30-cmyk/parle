# LLM Usage Pricing

> 30 nodes · cohesion 0.13

## Key Concepts

- **frameEval.ts** (19 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **addLlmUsage()** (17 connections) — `packages/brain/src/llm/client.ts`
- **drillEval.ts** (17 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **brain-playground/src/usage.ts** (16 connections) — `services/brain-playground/src/usage.ts`
- **costUsd()** (12 connections) — `packages/brain/src/llm/pricing.ts`
- **ZERO_USAGE** (10 connections) — `packages/brain/src/llm/client.ts`
- **pricing.ts** (10 connections) — `packages/brain/src/llm/pricing.ts`
- **buildScenarioRequest()** (8 connections) — `packages/brain/src/prompt/scenarioPrompt.ts`
- **formatTurnUsage()** (8 connections) — `services/brain-playground/src/usage.ts`
- **priceUsage()** (7 connections) — `packages/brain/src/llm/pricing.ts`
- **pricing.test.ts** (7 connections) — `packages/brain/src/llm/pricing.test.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **carriesFrench()** (6 connections) — `packages/brain/src/frenchLeak.ts`
- **DEFAULT_OPENAI_ANALYST_MODEL** (5 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **formatSessionUsage()** (5 connections) — `services/brain-playground/src/usage.ts`
- **checkFrame()** (4 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **pricedNote()** (4 connections) — `services/brain-playground/src/usage.ts`
- **mergedModel()** (3 connections) — `packages/brain/src/llm/client.ts`
- **USD_PER_MTOK** (3 connections) — `packages/brain/src/llm/pricing.ts`
- **billedNothing()** (2 connections) — `packages/brain/src/llm/client.ts`
- **pickClient()** (2 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **pickClient()** (2 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **k()** (2 connections) — `services/brain-playground/src/usage.ts`
- **FALLBACK_PRICE_MODEL** (1 connections) — `packages/brain/src/llm/pricing.ts`
- *... and 5 more nodes in this community*

## Relationships

- [Brain LLM Client Types](Brain_LLM_Client_Types.md) (20 shared connections)
- [Playground Chat CLI](Playground_Chat_CLI.md) (13 shared connections)
- [Coach Sample Fixtures](Coach_Sample_Fixtures.md) (12 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (9 shared connections)
- [Brain Client Config Tests](Brain_Client_Config_Tests.md) (8 shared connections)
- [Conversation Brain Spend](Conversation_Brain_Spend.md) (7 shared connections)
- [Brain Contract Methods](Brain_Contract_Methods.md) (2 shared connections)
- [Topic Curation](Topic_Curation.md) (2 shared connections)
- [Drill Exercise Validation](Drill_Exercise_Validation.md) (2 shared connections)
- [Environment Preflight](Environment_Preflight.md) (1 shared connections)
- [Path Node Status Line](Path_Node_Status_Line.md) (1 shared connections)

## Source Files

- `packages/brain/src/frenchLeak.ts`
- `packages/brain/src/llm/client.ts`
- `packages/brain/src/llm/openaiResponses.ts`
- `packages/brain/src/llm/pricing.test.ts`
- `packages/brain/src/llm/pricing.ts`
- `packages/brain/src/prompt/scenarioPrompt.ts`
- `services/brain-playground/src/eval/drillEval.ts`
- `services/brain-playground/src/eval/frameEval.ts`
- `services/brain-playground/src/usage.ts`

## Audit Trail

- EXTRACTED: 133 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*