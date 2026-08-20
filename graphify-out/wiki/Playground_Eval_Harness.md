# Playground Eval Harness

> 21 nodes · cohesion 0.18

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

- [Playground Chat Commands](Playground_Chat_Commands.md) (14 shared connections)
- [Tutor Copy Rules](Tutor_Copy_Rules.md) (9 shared connections)
- [Brain Client Contracts](Brain_Client_Contracts.md) (8 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (7 shared connections)
- [Anthropic and Claude CLI Providers](Anthropic_and_Claude_CLI_Providers.md) (4 shared connections)
- [Conversation Orchestrator](Conversation_Orchestrator.md) (4 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (3 shared connections)
- [Alternate Brain Clients](Alternate_Brain_Clients.md) (3 shared connections)
- [Drill Generation Prompt](Drill_Generation_Prompt.md) (2 shared connections)
- [Anthropic Brain Client](Anthropic_Brain_Client.md) (2 shared connections)
- [Drill Batch Validation](Drill_Batch_Validation.md) (2 shared connections)
- [Scenario Prompt and Grading](Scenario_Prompt_and_Grading.md) (1 shared connections)

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

- EXTRACTED: 100 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*