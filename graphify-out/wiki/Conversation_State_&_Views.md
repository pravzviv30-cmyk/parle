# Conversation State & Views

> 81 nodes · cohesion 0.06

## Key Concepts

- **sessionLoop.ts** (43 connections) — `services/brain-playground/src/sessionLoop.ts`
- **runEval.ts** (38 connections) — `services/brain-playground/src/eval/runEval.ts`
- **chat.ts** (37 connections) — `services/brain-playground/src/chat.ts`
- **src/render.ts** (26 connections) — `services/brain-playground/src/render.ts`
- **ConversationState** (20 connections) — `packages/brain/src/engine/conversation.ts`
- **addLlmUsage()** (18 connections) — `packages/brain/src/llm/client.ts`
- **main()** (18 connections) — `services/brain-playground/src/chat.ts`
- **drillEval.ts** (17 connections) — `services/brain-playground/src/eval/drillEval.ts`
- **brain-playground/src/usage.ts** (17 connections) — `services/brain-playground/src/usage.ts`
- **costUsd()** (14 connections) — `packages/brain/src/llm/pricing.ts`
- **runInput()** (13 connections) — `services/brain-playground/src/sessionLoop.ts`
- **TurnView** (12 connections) — `packages/brain/src/engine/conversation.ts`
- **ZERO_USAGE** (11 connections) — `packages/brain/src/llm/client.ts`
- **runCase()** (11 connections) — `services/brain-playground/src/eval/runEval.ts`
- **profileStore.ts** (11 connections) — `services/brain-playground/src/profileStore.ts`
- **applyNonSpokenInput()** (10 connections) — `packages/brain/src/engine/conversation.ts`
- **pricing.ts** (10 connections) — `packages/brain/src/llm/pricing.ts`
- **defaultModel()** (9 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **SessionRecap** (8 connections) — `packages/brain/src/contract/types.ts`
- **commands.ts** (8 connections) — `services/brain-playground/src/commands.ts`
- **meta** (8 connections) — `services/brain-playground/src/render.ts`
- **renderRecap()** (8 connections) — `services/brain-playground/src/render.ts`
- **beginSession()** (8 connections) — `services/brain-playground/src/sessionLoop.ts`
- **formatTurnUsage()** (8 connections) — `services/brain-playground/src/usage.ts`
- **CoachItem** (7 connections) — `packages/brain/src/contract/types.ts`
- *... and 56 more nodes in this community*

## Relationships

- [LLM Schema Definitions](LLM_Schema_Definitions.md) (55 shared connections)
- [Coach Copy Samples](Coach_Copy_Samples.md) (51 shared connections)
- [Conversation Engine Core](Conversation_Engine_Core.md) (23 shared connections)
- [Profile Merge Logic](Profile_Merge_Logic.md) (18 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (14 shared connections)
- [Phrase Curation](Phrase_Curation.md) (10 shared connections)
- [Conversation Test Fixtures](Conversation_Test_Fixtures.md) (8 shared connections)
- [Pedagogy Ladder Logic](Pedagogy_Ladder_Logic.md) (4 shared connections)
- [Path Node Row UI](Path_Node_Row_UI.md) (3 shared connections)
- [Situation Chooser UI](Situation_Chooser_UI.md) (2 shared connections)
- [Turn Timing Metrics](Turn_Timing_Metrics.md) (2 shared connections)
- [Drill Validation](Drill_Validation.md) (2 shared connections)

## Source Files

- `packages/brain/src/contract/types.ts`
- `packages/brain/src/engine/conversation.ts`
- `packages/brain/src/llm/client.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `packages/brain/src/llm/pricing.test.ts`
- `packages/brain/src/llm/pricing.ts`
- `services/brain-playground/src/chat.ts`
- `services/brain-playground/src/commands.test.ts`
- `services/brain-playground/src/commands.ts`
- `services/brain-playground/src/eval/drillEval.ts`
- `services/brain-playground/src/eval/runEval.ts`
- `services/brain-playground/src/profileStore.test.ts`
- `services/brain-playground/src/profileStore.ts`
- `services/brain-playground/src/render.ts`
- `services/brain-playground/src/sessionLoop.test.ts`
- `services/brain-playground/src/sessionLoop.ts`
- `services/brain-playground/src/usage.ts`
- `services/tutor-agent/src/convo.ts`

## Audit Trail

- EXTRACTED: 389 (99%)
- INFERRED: 3 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*