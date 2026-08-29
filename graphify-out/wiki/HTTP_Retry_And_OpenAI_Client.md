# HTTP Retry And OpenAI Client

> 34 nodes · cohesion 0.12

## Key Concepts

- **openaiResponses.ts** (56 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **OpenAiResponsesBrainClient** (24 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.complete()** (16 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **bodyFor()** (9 connections) — `packages/brain/src/llm/openaiResponses.test.ts`
- **http.ts** (8 connections) — `packages/brain/src/llm/http.ts`
- **FetchLike** (7 connections) — `packages/brain/src/llm/http.ts`
- **SleepLike** (7 connections) — `packages/brain/src/llm/http.ts`
- **.curate()** (7 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.drills()** (7 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.extract()** (7 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.frame()** (7 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.turn()** (7 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **instructionsFor()** (6 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **retryAfterMs()** (5 connections) — `packages/brain/src/llm/http.ts`
- **.post()** (5 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.constructor()** (4 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **.constructor()** (4 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **realSleep()** (3 connections) — `packages/brain/src/llm/http.ts`
- **cacheKeyFor()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **inputMessages()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **.send()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **parseFailure()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **schemaJson()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- **clientOver()** (2 connections) — `packages/brain/src/llm/openaiResponses.test.ts`
- **unwrap()** (2 connections) — `packages/brain/src/llm/openaiResponses.ts`
- *... and 9 more nodes in this community*

## Relationships

- [Claude CLI Brain Client](Claude_CLI_Brain_Client.md) (40 shared connections)
- [Brain Contract Zod Schemas](Brain_Contract_Zod_Schemas.md) (25 shared connections)
- [Claude CLI Run And Usage](Claude_CLI_Run_And_Usage.md) (8 shared connections)
- [Topic Curation Pipeline](Topic_Curation_Pipeline.md) (3 shared connections)
- [Memory Fact Extraction Prompt](Memory_Fact_Extraction_Prompt.md) (2 shared connections)
- [Conversation Flow Orchestration](Conversation_Flow_Orchestration.md) (2 shared connections)
- [Drill Exercise Generation](Drill_Exercise_Generation.md) (1 shared connections)
- [Brain Playground Chat CLI](Brain_Playground_Chat_CLI.md) (1 shared connections)
- [Coach Output Samples And Checks](Coach_Output_Samples_And_Checks.md) (1 shared connections)

## Source Files

- `packages/brain/src/llm/http.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `packages/brain/src/llm/openaiResponses.test.ts`
- `packages/brain/src/llm/openaiResponses.ts`

## Audit Trail

- EXTRACTED: 143 (97%)
- INFERRED: 5 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*