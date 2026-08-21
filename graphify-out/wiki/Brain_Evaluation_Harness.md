# Brain Evaluation Harness

> 22 nodes · cohesion 0.17

## Key Concepts

- **buildSystemBlocks()** (21 connections) — `packages/brain/src/prompt/system.ts`
- **frameEval.ts** (16 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **brain-playground/src/usage.ts** (16 connections) — `services/brain-playground/src/usage.ts`
- **drillEval.ts** (15 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **addUsage()** (9 connections) — `services/brain-playground/src/usage.ts`
- **costUsd()** (9 connections) — `services/brain-playground/src/usage.ts`
- **buildScenarioRequest()** (8 connections) — `packages/brain/src/prompt/scenarioPrompt.ts`
- **ZERO_USAGE** (7 connections) — `packages/brain/src/llm/client.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **main()** (7 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **.buildFrame()** (6 connections) — `services/tutor-agent/src/convo.ts`
- **formatSessionUsage()** (4 connections) — `services/brain-playground/src/usage.ts`
- **checkFrame()** (3 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **blocks()** (2 connections) — `packages/brain/src/llm/claudeCli.test.ts`
- **blocks()** (2 connections) — `packages/brain/src/llm/split.test.ts`
- **pickClient()** (2 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **pickClient()** (2 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **k()** (2 connections) — `services/brain-playground/src/usage.ts`
- **PROFILES** (1 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **REQUESTS** (1 connections) — `services/brain-playground/src/eval/frameEval.ts`
- **MtokPrices** (1 connections) — `services/brain-playground/src/usage.ts`
- **USD_PER_MTOK** (1 connections) — `services/brain-playground/src/usage.ts`

## Relationships

- [Brain Playground CLI](Brain_Playground_CLI.md) (14 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (8 shared connections)
- [Learner Copy Rules](Learner_Copy_Rules.md) (8 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (8 shared connections)
- [Live Conversation Orchestrator](Live_Conversation_Orchestrator.md) (4 shared connections)
- [Anthropic And Claude CLI Clients](Anthropic_And_Claude_CLI_Clients.md) (3 shared connections)
- [Tutor Tab Curation](Tutor_Tab_Curation.md) (3 shared connections)
- [Memory Extraction Client](Memory_Extraction_Client.md) (3 shared connections)
- [Conversation State Machine](Conversation_State_Machine.md) (2 shared connections)
- [Drill Generation Prompts](Drill_Generation_Prompts.md) (2 shared connections)
- [Anthropic Brain Client](Anthropic_Brain_Client.md) (2 shared connections)
- [Drill Validation Fixtures](Drill_Validation_Fixtures.md) (2 shared connections)

## Source Files

- `packages/brain/src/llm/claudeCli.test.ts`
- `packages/brain/src/llm/client.ts`
- `packages/brain/src/llm/split.test.ts`
- `packages/brain/src/prompt/scenarioPrompt.ts`
- `packages/brain/src/prompt/system.ts`
- `services/brain-playground/src/eval/drillEval.ts`
- `services/brain-playground/src/eval/frameEval.ts`
- `services/brain-playground/src/usage.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 102 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*