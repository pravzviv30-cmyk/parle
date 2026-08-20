# Playground CLI Commands

> 41 nodes · cohesion 0.13

## Key Concepts

- **sessionLoop.ts** (42 connections) — `services/brain-playground/src/sessionLoop.ts`
- **chat.ts** (34 connections) — `services/brain-playground/src/chat.ts`
- **src/render.ts** (26 connections) — `services/brain-playground/src/render.ts`
- **main()** (18 connections) — `services/brain-playground/src/chat.ts`
- **runInput()** (14 connections) — `services/brain-playground/src/sessionLoop.ts`
- **profileStore.ts** (11 connections) — `services/brain-playground/src/profileStore.ts`
- **defaultModel()** (8 connections) — `packages/brain/src/llm/openaiCompat.ts`
- **commands.ts** (8 connections) — `services/brain-playground/src/commands.ts`
- **meta** (8 connections) — `services/brain-playground/src/render.ts`
- **renderRecap()** (8 connections) — `services/brain-playground/src/render.ts`
- **renderTurnView()** (7 connections) — `services/brain-playground/src/render.ts`
- **warm** (7 connections) — `services/brain-playground/src/render.ts`
- **beginSession()** (7 connections) — `services/brain-playground/src/sessionLoop.ts`
- **buildScenario()** (7 connections) — `services/brain-playground/src/sessionLoop.ts`
- **SessionRecap** (6 connections) — `packages/brain/src/contract/types.ts`
- **loadProfile()** (6 connections) — `services/brain-playground/src/profileStore.ts`
- **profileStore.test.ts** (6 connections) — `services/brain-playground/src/profileStore.test.ts`
- **renderOpening()** (6 connections) — `services/brain-playground/src/render.ts`
- **renderRescue()** (6 connections) — `services/brain-playground/src/render.ts`
- **title** (6 connections) — `services/brain-playground/src/render.ts`
- **resetProfile()** (5 connections) — `services/brain-playground/src/profileStore.ts`
- **saveProfile()** (5 connections) — `services/brain-playground/src/profileStore.ts`
- **rungLine()** (5 connections) — `services/brain-playground/src/render.ts`
- **endSession()** (5 connections) — `services/brain-playground/src/sessionLoop.ts`
- **pickClient()** (4 connections) — `services/brain-playground/src/chat.ts`
- *... and 16 more nodes in this community*

## Relationships

- [LLM Client Adapters](LLM_Client_Adapters.md) (19 shared connections)
- [Learner Profile Model](Learner_Profile_Model.md) (16 shared connections)
- [Turn Integration & Copy Rules](Turn_Integration_&_Copy_Rules.md) (15 shared connections)
- [Drill Generation Prompts](Drill_Generation_Prompts.md) (13 shared connections)
- [French Authenticity Pack](French_Authenticity_Pack.md) (6 shared connections)
- [Contract Schemas & Samples](Contract_Schemas_&_Samples.md) (5 shared connections)
- [Profile Store & Upgrade](Profile_Store_&_Upgrade.md) (3 shared connections)
- [Conversation State Pipeline](Conversation_State_Pipeline.md) (3 shared connections)
- [Conversation Engine Tests](Conversation_Engine_Tests.md) (2 shared connections)
- [Convo Frames & Usage](Convo_Frames_&_Usage.md) (1 shared connections)
- [Agent Env Preflight](Agent_Env_Preflight.md) (1 shared connections)
- [Topic Curation](Topic_Curation.md) (1 shared connections)

## Source Files

- `packages/brain/src/contract/types.ts`
- `packages/brain/src/llm/openaiCompat.ts`
- `services/brain-playground/src/chat.ts`
- `services/brain-playground/src/commands.test.ts`
- `services/brain-playground/src/commands.ts`
- `services/brain-playground/src/profileStore.test.ts`
- `services/brain-playground/src/profileStore.ts`
- `services/brain-playground/src/render.ts`
- `services/brain-playground/src/sessionLoop.ts`

## Audit Trail

- EXTRACTED: 191 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*